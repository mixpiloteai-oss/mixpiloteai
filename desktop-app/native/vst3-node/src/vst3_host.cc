// ── vst3_host.cc ──────────────────────────────────────────────────────────────
// VST3 host implementation: scanning, instance lifecycle, audio processing.
// ─────────────────────────────────────────────────────────────────────────────

#include "vst3_host.h"

#include <algorithm>
#include <cassert>
#include <cerrno>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <random>
#include <sstream>

namespace fs = std::filesystem;

// ── Helpers ───────────────────────────────────────────────────────────────────

static std::string cstrSafe(const char* s, size_t max) {
  size_t len = strnlen(s, max);
  return std::string(s, len);
}

std::string Vst3Host::generateId() {
  std::random_device rd;
  std::mt19937 gen(rd());
  std::uniform_int_distribution<uint32_t> dis(0, 0xFFFFFFFF);
  char buf[37];
  uint32_t a = dis(gen), b = dis(gen), c = dis(gen), d = dis(gen);
  snprintf(buf, sizeof(buf), "%08X-%04X-%04X-%04X-%012X",
    a, b >> 16, (b & 0xFFFF) | 0x4000,
    (c >> 16) | 0x8000, ((uint64_t)(c & 0xFFFF) << 32) | d);
  return std::string(buf);
}

// ── Binary resolution ─────────────────────────────────────────────────────────

std::string Vst3Host::resolveBinary(const std::string& bundlePath) const {
  fs::path bundle(bundlePath);
  std::string stem = bundle.stem().string();

  // Platform binary directories in order of preference (VST3 bundle spec)
#if defined(_WIN32)
  std::vector<std::string> subdirs = {"Contents/x86_64-win", "Contents/Win64"};
  std::vector<std::string> exts    = {".vst3"};
#elif defined(__APPLE__)
  std::vector<std::string> subdirs = {"Contents/MacOS"};
  std::vector<std::string> exts    = {"", ".dylib"};
#else
  std::vector<std::string> subdirs = {"Contents/x86_64-linux", "Contents/Linux"};
  std::vector<std::string> exts    = {".so"};
#endif

  for (const auto& sub : subdirs) {
    fs::path subDir = bundle / sub;
    for (const auto& ext : exts) {
      fs::path candidate = subDir / (stem + ext);
      if (fs::exists(candidate)) return candidate.string();
    }
    // Try without stem (macOS bundle sometimes uses bundle name)
    for (const auto& ext : exts) {
      if (!ext.empty()) continue;
      // macOS: binary file without extension named after the bundle
      fs::path candidate = subDir / stem;
      if (fs::exists(candidate)) return candidate.string();
    }
  }

  // Fallback: maybe the path itself is already the binary
  if (fs::is_regular_file(bundle)) return bundlePath;

  return "";
}

// ── Factory open ──────────────────────────────────────────────────────────────

IPluginFactory* Vst3Host::openFactory(const std::string& binaryPath,
                                       DlHandle& libOut,
                                       std::string& error) {
  libOut = VST3_DLOPEN(binaryPath.c_str());
  if (!libOut) {
#ifdef _WIN32
    error = "LoadLibrary failed for: " + binaryPath;
#else
    const char* dlErr = dlerror();
    error = std::string("dlopen failed for '") + binaryPath + "': " +
            (dlErr ? dlErr : "unknown error");
#endif
    return nullptr;
  }

  // Optional InitDll / ModuleEntry (Windows / JUCE plugins call this)
  auto initFn = reinterpret_cast<InitModuleFn>(VST3_DLSYM(libOut, "InitDll"));
  if (!initFn) initFn = reinterpret_cast<InitModuleFn>(VST3_DLSYM(libOut, "ModuleEntry"));
  if (initFn) initFn();

  auto getFactory = reinterpret_cast<GetPluginFactoryFn>(
    VST3_DLSYM(libOut, "GetPluginFactory"));
  if (!getFactory) {
    error = "GetPluginFactory symbol not found in: " + binaryPath;
    VST3_DLCLOSE(libOut);
    libOut = nullptr;
    return nullptr;
  }

  IPluginFactory* factory = getFactory();
  if (!factory) {
    error = "GetPluginFactory returned null for: " + binaryPath;
    VST3_DLCLOSE(libOut);
    libOut = nullptr;
    return nullptr;
  }

  return factory;
}

// ── scanPlugin ────────────────────────────────────────────────────────────────

Vst3PluginInfo Vst3Host::scanPlugin(const std::string& bundlePath,
                                     std::string& error) const {
  Vst3PluginInfo info;

  std::string binaryPath = resolveBinary(bundlePath);
  if (binaryPath.empty()) {
    error = "No platform binary found in bundle: " + bundlePath;
    return info;
  }

  DlHandle lib = nullptr;
  IPluginFactory* factory = openFactory(binaryPath, lib, error);
  if (!factory) return info;

  // Read factory info for vendor name
  PFactoryInfo fi = {};
  if (factory->getFactoryInfo(&fi) == kResultOk) {
    info.vendor = cstrSafe(fi.vendor, sizeof(fi.vendor));
  } else {
    info.vendor = "Unknown";
  }

  // Enumerate classes
  int count = factory->countClasses();
  for (int i = 0; i < count; ++i) {
    PClassInfo ci = {};
    if (factory->getClassInfo(i, &ci) != kResultOk) continue;

    std::string cat = cstrSafe(ci.category, sizeof(ci.category));
    // "Audio Module Class" is the VST3 category for processors/instruments
    if (cat.find("Audio Module Class") == std::string::npos &&
        cat.find("Instrument")         == std::string::npos) continue;

    info.cid  = tuidToHex(ci.cid);
    info.name = cstrSafe(ci.name, sizeof(ci.name));
    if (info.name.empty()) {
      info.name = fs::path(bundlePath).stem().string();
    }

    // Try IPluginFactory2 for extended class info (subcategories, version, SDK)
    IPluginFactory2* factory2 = nullptr;
    if (factory->queryInterface(
        makeTUID(0x0007B650, 0xF24B4428, 0x584E4C00, 0x7D82993D),
        reinterpret_cast<void**>(&factory2)) == kResultOk && factory2) {
      PClassInfo2 ci2 = {};
      if (factory2->getClassInfo2(i, &ci2) == kResultOk) {
        info.version    = cstrSafe(ci2.version,    sizeof(ci2.version));
        info.sdkVersion = cstrSafe(ci2.sdkVersion, sizeof(ci2.sdkVersion));

        std::string subcats = cstrSafe(ci2.subCategories, sizeof(ci2.subCategories));
        if (!subcats.empty()) {
          std::istringstream ss(subcats);
          std::string token;
          while (std::getline(ss, token, '|')) {
            if (!token.empty()) info.subCategories.push_back(token);
          }
        }

        std::string subStr = subcats;
        std::transform(subStr.begin(), subStr.end(), subStr.begin(), ::tolower);
        if (subStr.find("instrument") != std::string::npos ||
            subStr.find("synth")      != std::string::npos) {
          info.category = "Instrument";
          info.supportsMidi = true;
        } else if (subStr.find("midi") != std::string::npos) {
          info.category = "Midi Effect";
          info.supportsMidi = true;
        } else {
          info.category = "Fx";
        }
        if (subStr.find("multichannel") != std::string::npos) {
          info.supportsMultiOut = true;
        }
      }
      factory2->release();
    }

    if (info.version.empty()) info.version = "1.0.0";
    if (info.category.empty()) {
      // Fallback from PClassInfo category field
      std::string catL = cat;
      std::transform(catL.begin(), catL.end(), catL.begin(), ::tolower);
      info.category = (catL.find("instrument") != std::string::npos) ? "Instrument" : "Fx";
    }

    // hasEditor: we don't know until createInstance; default true for instruments
    info.hasEditor = (info.category == "Instrument" || info.category == "Fx");
    info.inputBusCount  = 1;
    info.outputBusCount = 1;
    // parameterCount placeholder (real count requires creating the EditController)
    info.parameterCount = 0;

    break; // Use first audio module class
  }

  factory->release();
  VST3_DLCLOSE(lib);

  if (info.name.empty()) {
    error = "No Audio Module Class found in: " + bundlePath;
  }
  return info;
}

// ── createInstance ────────────────────────────────────────────────────────────

std::shared_ptr<Vst3Instance> Vst3Host::findInstance(const std::string& id) const {
  std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(instancesMutex_));
  auto it = instances_.find(id);
  if (it == instances_.end()) return nullptr;
  return it->second;
}

std::string Vst3Host::createInstance(const std::string& pluginPath,
                                      const std::string& componentId,
                                      std::string& error) {
  std::string binaryPath = resolveBinary(pluginPath);
  if (binaryPath.empty()) {
    error = "No platform binary found in bundle: " + pluginPath;
    return "";
  }

  auto inst = std::make_shared<Vst3Instance>();
  inst->pluginPath  = pluginPath;
  inst->componentId = componentId;

  // Open factory
  inst->factory = openFactory(binaryPath, inst->lib, error);
  if (!inst->factory) return "";

  // Construct the raw 16-byte CID for createInstance
  std::string rawCid = hexCidToFactoryString(componentId);
  if (rawCid.size() < 16) rawCid.resize(16, '\0');

  // IComponent IID as raw bytes
  char iComponentRaw[17] = {};
  std::memcpy(iComponentRaw, kIComponentIID.data, 16);

  void* obj = nullptr;
  tresult res = inst->factory->createInstance(rawCid.c_str(), iComponentRaw, &obj);
  if (res != kResultOk || !obj) {
    // Some plugins don't use the raw CID form; try the hex string directly
    res = inst->factory->createInstance(componentId.c_str(), iComponentRaw, &obj);
  }
  if (res != kResultOk || !obj) {
    error = "createInstance failed (result=" + std::to_string(res) + ") for CID: " + componentId;
    inst->factory->release();
    VST3_DLCLOSE(inst->lib);
    return "";
  }

  inst->component = reinterpret_cast<IComponent*>(obj);

  // Initialize component (pass nullptr for host context — minimal host)
  inst->component->initialize(nullptr);

  // Query IAudioProcessor
  {
    void* proc = nullptr;
    char iAudioProcRaw[17] = {};
    std::memcpy(iAudioProcRaw, kIAudioProcessorIID.data, 16);
    if (inst->component->queryInterface(kIAudioProcessorIID, &proc) == kResultOk && proc) {
      inst->processor = reinterpret_cast<IAudioProcessor*>(proc);
    }
  }

  // Query IEditController (may be the same object or a separate one)
  {
    void* ctrl = nullptr;
    if (inst->component->queryInterface(kIEditControllerIID, &ctrl) == kResultOk && ctrl) {
      inst->controller = reinterpret_cast<IEditController*>(ctrl);
      inst->controller->initialize(nullptr);
    } else {
      // Get controller class from component and instantiate separately
      TUID controllerCid = {};
      if (inst->component->getControllerClassId(controllerCid) == kResultOk) {
        char ctrlRaw[17] = {};
        std::memcpy(ctrlRaw, controllerCid.data, 16);
        char iCtrlRaw[17] = {};
        std::memcpy(iCtrlRaw, kIEditControllerIID.data, 16);
        void* ctrlObj = nullptr;
        if (inst->factory->createInstance(ctrlRaw, iCtrlRaw, &ctrlObj) == kResultOk && ctrlObj) {
          inst->controller = reinterpret_cast<IEditController*>(ctrlObj);
          inst->controller->initialize(nullptr);
        }
      }
    }
  }

  // Initialize channel buffer pointers
  for (int ch = 0; ch < Vst3Instance::kMaxChannels; ++ch) {
    inst->inputPtrs[ch]  = inst->inputData[ch];
    inst->outputPtrs[ch] = inst->outputData[ch];
  }

  std::string instanceId = generateId();
  inst->instanceId = instanceId;

  std::lock_guard<std::mutex> lock(instancesMutex_);
  instances_[instanceId] = inst;
  return instanceId;
}

// ── destroyInstance ───────────────────────────────────────────────────────────

void Vst3Host::destroyInstance(const std::string& instanceId) {
  std::shared_ptr<Vst3Instance> inst;
  {
    std::lock_guard<std::mutex> lock(instancesMutex_);
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return;
    inst = it->second;
    instances_.erase(it);
  }

  std::lock_guard<std::mutex> lock(inst->mutex);

  if (inst->plugView) {
    inst->plugView->removed();
    inst->plugView->release();
    inst->plugView = nullptr;
  }

  if (inst->processor && inst->active) {
    inst->processor->setProcessing(false);
    inst->component->setActive(false);
  }

  if (inst->controller) {
    inst->controller->terminate();
    inst->controller->release();
    inst->controller = nullptr;
  }
  if (inst->processor) {
    inst->processor->release();
    inst->processor = nullptr;
  }
  if (inst->component) {
    inst->component->terminate();
    inst->component->release();
    inst->component = nullptr;
  }
  if (inst->factory) {
    inst->factory->release();
    inst->factory = nullptr;
  }
  if (inst->lib) {
    // Try ExitDll / ModuleExit before unloading
    auto exitFn = reinterpret_cast<ExitModuleFn>(VST3_DLSYM(inst->lib, "ExitDll"));
    if (!exitFn) exitFn = reinterpret_cast<ExitModuleFn>(VST3_DLSYM(inst->lib, "ModuleExit"));
    if (exitFn) exitFn();
    VST3_DLCLOSE(inst->lib);
    inst->lib = nullptr;
  }
}

// ── setupProcessing ───────────────────────────────────────────────────────────

bool Vst3Host::setupProcessing(const std::string& instanceId,
                                int32_t sampleRate,
                                int32_t maxBlockSize,
                                int32_t symbolicSampleSize,
                                int32_t processMode,
                                std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }

  std::lock_guard<std::mutex> lock(inst->mutex);

  if (!inst->processor) {
    error = "Instance has no IAudioProcessor (plugin may not support audio processing)";
    return false;
  }

  inst->processSetup.processMode        = processMode;
  inst->processSetup.symbolicSampleSize = symbolicSampleSize;
  inst->processSetup.maxSamplesPerBlock  = std::min(maxBlockSize, (int32_t)Vst3Instance::kMaxBlockSize);
  inst->processSetup.sampleRate         = (double)sampleRate;

  // Activate stereo buses
  inst->component->activateBus(kAudio, kInput,  0, true);
  inst->component->activateBus(kAudio, kOutput, 0, true);

  // Stereo speaker arrangement (FL+FR = 3)
  SpeakerArrangement stereo = 3;
  inst->processor->setBusArrangements(&stereo, 1, &stereo, 1);

  tresult res = inst->processor->setupProcessing(inst->processSetup);
  if (res != kResultOk && res != kResultFalse) {
    error = "setupProcessing returned error: " + std::to_string(res);
    return false;
  }
  return true;
}

// ── activateInstance ──────────────────────────────────────────────────────────

bool Vst3Host::activateInstance(const std::string& instanceId, bool active, std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }

  std::lock_guard<std::mutex> lock(inst->mutex);

  if (inst->active == active) return true;

  inst->component->setActive(active ? 1 : 0);
  if (inst->processor) {
    inst->processor->setProcessing(active ? 1 : 0);
  }
  inst->active = active;
  return true;
}

// ── processBlock ──────────────────────────────────────────────────────────────

bool Vst3Host::processBlock(const std::string& instanceId,
                             const std::vector<std::vector<float>>& inputs,
                             std::vector<std::vector<float>>& outputs,
                             int32_t numSamples,
                             std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }

  std::lock_guard<std::mutex> lock(inst->mutex);

  if (!inst->processor) {
    // No IAudioProcessor — pass-through
    outputs = inputs;
    return true;
  }

  int32_t blockSize = std::min(numSamples, (int32_t)Vst3Instance::kMaxBlockSize);
  int32_t nIn  = (int32_t)std::min((int)inputs.size(),  Vst3Instance::kMaxChannels);
  int32_t nOut = (int32_t)std::min((int)outputs.size(), Vst3Instance::kMaxChannels);

  // Copy input into aligned channel arrays
  for (int ch = 0; ch < nIn; ++ch) {
    int32_t copyLen = std::min(blockSize, (int32_t)inputs[ch].size());
    std::memcpy(inst->inputData[ch], inputs[ch].data(), copyLen * sizeof(float));
    std::memset(inst->inputData[ch] + copyLen, 0, (blockSize - copyLen) * sizeof(float));
  }
  for (int ch = nIn; ch < Vst3Instance::kMaxChannels; ++ch) {
    std::memset(inst->inputData[ch], 0, blockSize * sizeof(float));
  }

  AudioBusBuffers inBus = {};
  inBus.numChannels = nIn;
  inBus.silenceFlags = 0;
  inBus.channelBuffers32 = inst->inputPtrs;

  AudioBusBuffers outBus = {};
  outBus.numChannels = nOut > 0 ? nOut : nIn;
  outBus.silenceFlags = 0;
  outBus.channelBuffers32 = inst->outputPtrs;

  ProcessData pd = {};
  pd.processMode        = inst->processSetup.processMode;
  pd.symbolicSampleSize = inst->processSetup.symbolicSampleSize;
  pd.numSamples         = blockSize;
  pd.numInputs          = 1;
  pd.numOutputs         = 1;
  pd.inputs             = &inBus;
  pd.outputs            = &outBus;
  // Note: inputParameterChanges/outputParameterChanges/inputEvents/outputEvents/processContext
  // are nullptr — a minimal host. Full SDK integration would populate these.
  // See: steinbergmedia/vst3sdk/pluginterfaces/vst/ivstprocesscontext.h

  tresult res = inst->processor->process(pd);
  if (res != kResultOk && res != kResultFalse) {
    error = "process() returned: " + std::to_string(res);
    return false;
  }

  // Copy output back
  int outChannels = outBus.numChannels;
  if ((int)outputs.size() < outChannels) outputs.resize(outChannels);
  for (int ch = 0; ch < outChannels; ++ch) {
    if ((int)outputs[ch].size() < blockSize) outputs[ch].resize(blockSize);
    std::memcpy(outputs[ch].data(), inst->outputData[ch], blockSize * sizeof(float));
  }

  return true;
}

// ── Parameters ────────────────────────────────────────────────────────────────

int32_t Vst3Host::getParameterCount(const std::string& instanceId, std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return 0; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->controller) return 0;
  return inst->controller->getParameterCount();
}

bool Vst3Host::getParameterInfo(const std::string& instanceId, int32_t index,
                                 ParamInfo& out, std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->controller) { error = "No IEditController"; return false; }

  ParameterInfo pi = {};
  if (inst->controller->getParameterInfo(index, pi) != kResultOk) {
    error = "getParameterInfo failed for index: " + std::to_string(index);
    return false;
  }

  out.id                    = pi.id;
  out.title                 = tcharToString(pi.title);
  out.shortTitle            = tcharToString(pi.shortTitle);
  out.units                 = tcharToString(pi.units);
  out.stepCount             = pi.stepCount;
  out.defaultNormalizedValue= pi.defaultNormalizedValue;
  out.unitId                = pi.unitId;
  out.flags                 = pi.flags;
  return true;
}

double Vst3Host::getParameterValue(const std::string& instanceId, uint32_t paramId,
                                    std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return 0.0; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->controller) { error = "No IEditController"; return 0.0; }
  return inst->controller->getParamNormalized(paramId);
}

bool Vst3Host::setParameterValue(const std::string& instanceId, uint32_t paramId,
                                  double value, std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->controller) { error = "No IEditController"; return false; }
  return inst->controller->setParamNormalized(paramId, value) == kResultOk;
}

bool Vst3Host::getAllParameterValues(const std::string& instanceId,
                                      std::vector<std::pair<uint32_t, double>>& out,
                                      std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->controller) return true; // no controller → empty list

  int32_t count = inst->controller->getParameterCount();
  out.clear();
  out.reserve(count);
  for (int32_t i = 0; i < count; ++i) {
    ParameterInfo pi = {};
    if (inst->controller->getParameterInfo(i, pi) == kResultOk) {
      double val = inst->controller->getParamNormalized(pi.id);
      out.emplace_back(pi.id, val);
    }
  }
  return true;
}

// ── State ─────────────────────────────────────────────────────────────────────

bool Vst3Host::getState(const std::string& instanceId, std::vector<uint8_t>& out,
                         std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->component) { error = "No IComponent"; return false; }

  MemoryStream* stream = new MemoryStream();
  tresult res = inst->component->getState(stream);
  if (res == kResultOk) {
    out = stream->buffer;
  } else {
    out.clear(); // Some plugins return kResultFalse when state is empty — treat as OK
  }
  stream->release();
  return true;
}

bool Vst3Host::setState(const std::string& instanceId, const std::vector<uint8_t>& data,
                         std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->component) { error = "No IComponent"; return false; }
  if (data.empty()) return true;

  MemoryStream* stream = new MemoryStream();
  stream->buffer = data;
  tresult res = inst->component->setState(stream);
  stream->release();
  if (res != kResultOk && res != kResultFalse) {
    error = "setState returned: " + std::to_string(res);
    return false;
  }
  // Sync controller state
  if (inst->controller) {
    MemoryStream* cs = new MemoryStream();
    cs->buffer = data;
    inst->controller->setComponentState(cs);
    cs->release();
  }
  return true;
}

// ── Editor ────────────────────────────────────────────────────────────────────

bool Vst3Host::attachEditor(const std::string& instanceId,
                             void* parentHandle,
                             int& width, int& height,
                             std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->controller) { error = "No IEditController"; return false; }

  if (inst->plugView) {
    inst->plugView->removed();
    inst->plugView->release();
    inst->plugView = nullptr;
  }

  void* viewObj = inst->controller->createView("editor");
  if (!viewObj) { error = "createView returned null"; return false; }

  inst->plugView = reinterpret_cast<IPlugView*>(viewObj);

  // Platform type string: "HWND" on Win, "NSView" on Mac, "X11EmbedWindowID" on Linux
#if defined(_WIN32)
  const char* platformType = "HWND";
#elif defined(__APPLE__)
  const char* platformType = "NSView";
#else
  const char* platformType = "X11EmbedWindowID";
#endif

  tresult res = inst->plugView->attached(parentHandle, platformType);
  if (res != kResultOk) {
    error = "IPlugView::attached returned: " + std::to_string(res);
    inst->plugView->release();
    inst->plugView = nullptr;
    return false;
  }

  ViewRect rect = {};
  if (inst->plugView->getSize(&rect) == kResultOk) {
    width  = rect.right  - rect.left;
    height = rect.bottom - rect.top;
  } else {
    width = 800; height = 600; // Fallback dimensions
  }
  return true;
}

bool Vst3Host::detachEditor(const std::string& instanceId, std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->plugView) return true; // Already detached
  inst->plugView->removed();
  inst->plugView->release();
  inst->plugView = nullptr;
  return true;
}

bool Vst3Host::resizeEditor(const std::string& instanceId, int width, int height,
                              std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  std::lock_guard<std::mutex> lock(inst->mutex);
  if (!inst->plugView) { error = "No active editor"; return false; }
  ViewRect rect = {0, 0, width, height};
  tresult res = inst->plugView->onSize(&rect);
  if (res != kResultOk && res != kResultFalse) {
    error = "onSize returned: " + std::to_string(res);
    return false;
  }
  return true;
}

// ── MIDI ──────────────────────────────────────────────────────────────────────
// Full MIDI event delivery requires IEventList (see VST3 SDK ivstevents.h).
// We queue MIDI here and deliver it in the next processBlock call via IEventList.
// For now: log the intent, no-op until IEventList is wired up.
// TODO(vstsdk): Implement IEventList wrapper and pass via ProcessData::inputEvents.

bool Vst3Host::sendMidi(const std::string& instanceId,
                         int /*type*/, int /*channel*/,
                         int /*note*/, int /*velocity*/,
                         int /*cc*/, double /*pitchBend*/,
                         std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  // TODO(vstsdk): Queue into IEventList; deliver in next processBlock.
  return true;
}

// ── Presets ───────────────────────────────────────────────────────────────────
// VST3 presets are stored as files (.vstpreset) or delivered via IUnitInfo.
// The full implementation requires the VST3 SDK's IUnitInfo / IUnitData interfaces.
// See: steinbergmedia/vst3sdk/pluginterfaces/vst/ivstunits.h

bool Vst3Host::getPresetCount(const std::string& instanceId, int& count, std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  // TODO(vstsdk): Query IUnitInfo::getProgramCount
  count = 0;
  return true;
}

bool Vst3Host::getPresetName(const std::string& instanceId, int /*index*/,
                              std::string& name, std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }
  // TODO(vstsdk): Query IUnitInfo::getProgramName
  name = "";
  return true;
}

bool Vst3Host::loadPreset(const std::string& instanceId, const std::string& path,
                           std::string& error) {
  auto inst = findInstance(instanceId);
  if (!inst) { error = "Instance not found: " + instanceId; return false; }

  // Read .vstpreset file and pass as IComponent state
  std::ifstream file(path, std::ios::binary);
  if (!file.is_open()) { error = "Cannot open preset: " + path; return false; }
  std::vector<uint8_t> data((std::istreambuf_iterator<char>(file)),
                             std::istreambuf_iterator<char>());
  return setState(instanceId, data, error);
}

bool Vst3Host::savePreset(const std::string& instanceId, const std::string& path,
                           std::string& error) {
  std::vector<uint8_t> data;
  if (!getState(instanceId, data, error)) return false;

  std::ofstream file(path, std::ios::binary);
  if (!file.is_open()) { error = "Cannot write preset: " + path; return false; }
  file.write(reinterpret_cast<const char*>(data.data()), data.size());
  return file.good();
}
