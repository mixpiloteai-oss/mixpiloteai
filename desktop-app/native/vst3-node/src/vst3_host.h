// ── vst3_host.h ───────────────────────────────────────────────────────────────
// VST3 COM interface definitions (inline, no SDK headers required for scanning).
// For full audio processing, link against the Steinberg VST3 SDK and replace the
// vtable stubs with proper IComponent / IAudioProcessor / IEditController calls.
//
// Steinberg VST3 SDK: https://github.com/steinbergmedia/vst3sdk (Apache 2.0)
// These interface IDs are from the VST3 specification (stable, publicly documented).
// ─────────────────────────────────────────────────────────────────────────────

#pragma once

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <mutex>
#include <atomic>
#include <functional>

#ifdef _WIN32
  #include <windows.h>
  #define VST3_DLOPEN(path)   LoadLibraryA(path)
  #define VST3_DLSYM(lib, sym) GetProcAddress((HMODULE)(lib), sym)
  #define VST3_DLCLOSE(lib)   FreeLibrary((HMODULE)(lib))
  typedef HMODULE DlHandle;
#else
  #include <dlfcn.h>
  #define VST3_DLOPEN(path)   dlopen(path, RTLD_LOCAL | RTLD_LAZY)
  #define VST3_DLSYM(lib, sym) dlsym(lib, sym)
  #define VST3_DLCLOSE(lib)   dlclose(lib)
  typedef void* DlHandle;
#endif

// ── Types ─────────────────────────────────────────────────────────────────────

typedef int32_t  tresult;
typedef uint32_t TBool;
typedef int32_t  int32;
typedef int64_t  int64;
typedef float    Sample32;
typedef double   Sample64;
typedef uint64_t SpeakerArrangement;

#ifdef _WIN32
  typedef wchar_t  TChar;
#else
  typedef char16_t TChar;
#endif

static constexpr tresult kResultOk    = 0;
static constexpr tresult kResultFalse = 1;
static constexpr tresult kNoInterface = static_cast<tresult>(0x80004002);
static constexpr tresult kResultTrue  = kResultOk;

// 16-byte interface ID (matches Steinberg FUID layout)
struct TUID { uint8_t data[16]; };

inline bool tuidEqual(const TUID& a, const TUID& b) {
  return std::memcmp(a.data, b.data, 16) == 0;
}

inline TUID makeTUID(uint32_t d0, uint32_t d1, uint32_t d2, uint32_t d3) {
  TUID id;
  auto store = [&](int off, uint32_t v) {
    id.data[off]   = (v >> 24) & 0xff;
    id.data[off+1] = (v >> 16) & 0xff;
    id.data[off+2] = (v >>  8) & 0xff;
    id.data[off+3] =  v        & 0xff;
  };
  store(0, d0); store(4, d1); store(8, d2); store(12, d3);
  return id;
}

// Steinberg VST3 interface IDs (from public SDK specification)
static const TUID kIComponentIID     = makeTUID(0xE831FF31, 0xF2D54301, 0x928EBBEE, 0x25697802);
static const TUID kIAudioProcessorIID= makeTUID(0x42043F99, 0xB7DA453C, 0xA569E79D, 0x9AAEC33D);
static const TUID kIEditControllerIID= makeTUID(0xDCD7BBE3, 0x7742448D, 0xA874AACC, 0x979C759E);
static const TUID kIPlugViewIID      = makeTUID(0x5BC32507, 0xD06049EA, 0xA6151B52, 0x2B755B29);
static const TUID kIBStreamIID       = makeTUID(0xC3BF6EA2, 0x30994752, 0x9B6BF990, 0x1BF14E30);

// ── FUnknown (IUnknown equivalent) ────────────────────────────────────────────

struct FUnknown {
  virtual tresult PLUGIN_API queryInterface(const TUID& iid, void** obj) = 0;
  virtual uint32_t PLUGIN_API addRef() = 0;
  virtual uint32_t PLUGIN_API release() = 0;
  virtual ~FUnknown() = default;

#ifdef _WIN32
  #define PLUGIN_API __stdcall
#else
  #define PLUGIN_API
#endif
};

// ── IPluginBase ───────────────────────────────────────────────────────────────

struct IPluginBase : FUnknown {
  virtual tresult PLUGIN_API initialize(FUnknown* context) = 0;
  virtual tresult PLUGIN_API terminate() = 0;
};

// ── Factory types ─────────────────────────────────────────────────────────────

#pragma pack(push, 1)
struct PFactoryInfo {
  char vendor[64];
  char url[256];
  char email[128];
  int32_t flags;
};

struct PClassInfo {
  TUID cid;
  int32_t cardinality;
  char category[32];
  char name[64];
};

struct PClassInfo2 {
  TUID cid;
  int32_t cardinality;
  char category[32];
  char name[64];
  uint32_t classFlags;
  char subCategories[128];
  char vendor[64];
  char version[64];
  char sdkVersion[64];
};
#pragma pack(pop)

// ── IPluginFactory ────────────────────────────────────────────────────────────

struct IPluginFactory : FUnknown {
  virtual tresult PLUGIN_API getFactoryInfo(PFactoryInfo* info) = 0;
  virtual int32_t PLUGIN_API countClasses() = 0;
  virtual tresult PLUGIN_API getClassInfo(int32_t index, PClassInfo* info) = 0;
  virtual tresult PLUGIN_API createInstance(const char* cid, const char* iid, void** obj) = 0;
};

struct IPluginFactory2 : IPluginFactory {
  virtual tresult PLUGIN_API getClassInfo2(int32_t index, PClassInfo2* info) = 0;
};

typedef IPluginFactory* (*GetPluginFactoryFn)();
typedef bool (*InitModuleFn)();
typedef bool (*ExitModuleFn)();

// ── Audio processing types ────────────────────────────────────────────────────
// Minimal definitions matching VST3 SDK structures.
// Full definitions: steinbergmedia/vst3sdk/pluginterfaces/vst/ivstaudioprocessor.h

enum MediaType { kAudio = 0, kEvent = 1 };
enum BusDirection { kInput = 0, kOutput = 1 };
enum BusType { kMain = 0, kAux = 1 };
enum IoMode { kSimple = 0, kAdvanced = 1, kOfflineProcessing = 3 };

struct BusInfo {
  int32_t mediaType;
  int32_t direction;
  int32_t channelCount;
  TChar name[128];
  int32_t busType;
  uint32_t flags;
};

struct ProcessSetup {
  int32_t processMode;       // 0=realtime, 1=offline
  int32_t symbolicSampleSize;// 0=float32, 1=float64
  int32_t maxSamplesPerBlock;
  double sampleRate;
};

struct AudioBusBuffers {
  int32_t numChannels;
  uint64_t silenceFlags;
  union {
    float** channelBuffers32;
    double** channelBuffers64;
  };
};

struct ProcessContext {
  uint32_t state;
  double sampleRate;
  int64_t projectTimeSamples;
  int64_t systemTime;
  double continousTimeSamples;
  double projectTimeMusic;
  double barPositionMusic;
  double cycleStartMusic;
  double cycleEndMusic;
  double tempo;
  int32_t timeSigNumerator;
  int32_t timeSigDenominator;
  int32_t chord;
  int32_t smpteOffsetSubframes;
  int32_t frameRate;
  int32_t samplesToNextClock;
};

struct ProcessData {
  int32_t processMode;
  int32_t symbolicSampleSize;
  int32_t numSamples;
  int32_t numInputs;
  int32_t numOutputs;
  AudioBusBuffers* inputs;
  AudioBusBuffers* outputs;
  // IParameterChanges, IEventList, ProcessContext pointers follow in full SDK
  void* inputParameterChanges;
  void* outputParameterChanges;
  void* inputEvents;
  void* outputEvents;
  ProcessContext* processContext;
};

// ── IAudioProcessor ───────────────────────────────────────────────────────────

struct IAudioProcessor : FUnknown {
  virtual tresult PLUGIN_API setBusArrangements(SpeakerArrangement* inputs, int32_t numIns,
                                                SpeakerArrangement* outputs, int32_t numOuts) = 0;
  virtual tresult PLUGIN_API getBusArrangement(int32_t dir, int32_t index, SpeakerArrangement& arr) = 0;
  virtual tresult PLUGIN_API canProcessSampleSize(int32_t symbolicSampleSize) = 0;
  virtual uint32_t PLUGIN_API getLatencySamples() = 0;
  virtual tresult PLUGIN_API setupProcessing(ProcessSetup& setup) = 0;
  virtual tresult PLUGIN_API setProcessing(TBool state) = 0;
  virtual tresult PLUGIN_API process(ProcessData& data) = 0;
  virtual uint32_t PLUGIN_API getTailSamples() = 0;
};

// ── IComponent ────────────────────────────────────────────────────────────────

struct IComponent : IPluginBase {
  virtual tresult PLUGIN_API getControllerClassId(TUID& classID) = 0;
  virtual tresult PLUGIN_API setIoMode(int32_t mode) = 0;
  virtual int32_t PLUGIN_API getBusCount(int32_t mediaType, int32_t dir) = 0;
  virtual tresult PLUGIN_API getBusInfo(int32_t mediaType, int32_t dir, int32_t index, BusInfo& bus) = 0;
  virtual tresult PLUGIN_API getRoutingInfo(void* inInfo, void* outInfo) = 0;
  virtual tresult PLUGIN_API activateBus(int32_t mediaType, int32_t dir, int32_t index, TBool state) = 0;
  virtual tresult PLUGIN_API setActive(TBool state) = 0;
  virtual tresult PLUGIN_API setState(void* state) = 0;
  virtual tresult PLUGIN_API getState(void* state) = 0;
};

// ── IEditController parameter types ──────────────────────────────────────────

struct ParameterInfo {
  uint32_t id;
  TChar title[128];
  TChar shortTitle[128];
  TChar units[128];
  int32_t stepCount;
  double defaultNormalizedValue;
  int32_t unitId;
  int32_t flags;
};

struct IEditController : IPluginBase {
  virtual tresult PLUGIN_API setComponentState(void* state) = 0;
  virtual tresult PLUGIN_API setState(void* state) = 0;
  virtual tresult PLUGIN_API getState(void* state) = 0;
  virtual int32_t PLUGIN_API getParameterCount() = 0;
  virtual tresult PLUGIN_API getParameterInfo(int32_t paramIndex, ParameterInfo& info) = 0;
  virtual tresult PLUGIN_API getParamStringByValue(uint32_t id, double valueNormalized, TChar* str) = 0;
  virtual tresult PLUGIN_API getParamValueByString(uint32_t id, TChar* str, double& valueNormalized) = 0;
  virtual double PLUGIN_API normalizedParamToPlain(uint32_t id, double valueNormalized) = 0;
  virtual double PLUGIN_API plainParamToNormalized(uint32_t id, double plainValue) = 0;
  virtual double PLUGIN_API getParamNormalized(uint32_t id) = 0;
  virtual tresult PLUGIN_API setParamNormalized(uint32_t id, double value) = 0;
  virtual tresult PLUGIN_API setComponentHandler(void* handler) = 0;
  virtual void*   PLUGIN_API createView(const char* name) = 0;
};

// ── IBStream (memory stream for state) ───────────────────────────────────────

struct IBStream : FUnknown {
  virtual tresult PLUGIN_API read(void* buffer, int32_t numBytes, int32_t* numBytesRead) = 0;
  virtual tresult PLUGIN_API write(void* buffer, int32_t numBytes, int32_t* numBytesWritten) = 0;
  virtual tresult PLUGIN_API seek(int64_t pos, int32_t mode, int64_t* result) = 0;
  virtual tresult PLUGIN_API tell(int64_t* pos) = 0;
};

// Concrete IBStream implementation backed by a std::vector<uint8_t>
class MemoryStream : public IBStream {
public:
  std::vector<uint8_t> buffer;
  int64_t cursor = 0;

  tresult PLUGIN_API queryInterface(const TUID&, void**) override { return kNoInterface; }
  uint32_t PLUGIN_API addRef() override { return ++refCount; }
  uint32_t PLUGIN_API release() override {
    if (--refCount == 0) { delete this; return 0; }
    return refCount;
  }

  tresult PLUGIN_API read(void* buf, int32_t numBytes, int32_t* read) override {
    int64_t avail = (int64_t)buffer.size() - cursor;
    int32_t n = (int32_t)std::min((int64_t)numBytes, avail);
    if (n > 0) { std::memcpy(buf, buffer.data() + cursor, n); cursor += n; }
    if (read) *read = n;
    return kResultOk;
  }

  tresult PLUGIN_API write(void* buf, int32_t numBytes, int32_t* written) override {
    auto needed = cursor + numBytes;
    if (needed > (int64_t)buffer.size()) buffer.resize((size_t)needed);
    std::memcpy(buffer.data() + cursor, buf, numBytes);
    cursor += numBytes;
    if (written) *written = numBytes;
    return kResultOk;
  }

  tresult PLUGIN_API seek(int64_t pos, int32_t mode, int64_t* result) override {
    if (mode == 0) cursor = pos;                              // SEEK_SET
    else if (mode == 1) cursor += pos;                        // SEEK_CUR
    else cursor = (int64_t)buffer.size() + pos;               // SEEK_END
    cursor = std::max((int64_t)0, cursor);
    if (result) *result = cursor;
    return kResultOk;
  }

  tresult PLUGIN_API tell(int64_t* pos) override {
    if (pos) *pos = cursor;
    return kResultOk;
  }

private:
  std::atomic<uint32_t> refCount{1};
};

// ── IPlugView (editor window) ─────────────────────────────────────────────────

struct ViewRect { int32_t left, top, right, bottom; };

struct IPlugView : FUnknown {
  virtual tresult PLUGIN_API isPlatformTypeSupported(const char* type) = 0;
  virtual tresult PLUGIN_API attached(void* parent, const char* type) = 0;
  virtual tresult PLUGIN_API removed() = 0;
  virtual tresult PLUGIN_API onWheel(float distance) = 0;
  virtual tresult PLUGIN_API onKeyDown(char16_t key, int16_t keyCode, int16_t modifiers) = 0;
  virtual tresult PLUGIN_API onKeyUp(char16_t key, int16_t keyCode, int16_t modifiers) = 0;
  virtual tresult PLUGIN_API getSize(ViewRect* size) = 0;
  virtual tresult PLUGIN_API onSize(ViewRect* newSize) = 0;
  virtual tresult PLUGIN_API onFocus(TBool state) = 0;
  virtual tresult PLUGIN_API setFrame(void* frame) = 0;
  virtual tresult PLUGIN_API canResize() = 0;
  virtual tresult PLUGIN_API checkSizeConstraint(ViewRect* rect) = 0;
};

// ── Vst3Host ──────────────────────────────────────────────────────────────────

struct Vst3PluginInfo {
  std::string cid;
  std::string name;
  std::string vendor;
  std::string version;
  std::string sdkVersion;
  std::string category;
  std::vector<std::string> subCategories;
  bool hasEditor = false;
  int  parameterCount = 0;
  int  inputBusCount = 0;
  int  outputBusCount = 0;
  bool supportsMidi = false;
  bool supportsMultiOut = false;
  int  programCount = 0;
};

struct ParamInfo {
  uint32_t id;
  std::string title;
  std::string shortTitle;
  std::string units;
  int32_t stepCount;
  double defaultNormalizedValue;
  int32_t unitId;
  int32_t flags;
};

struct Vst3Instance {
  std::string instanceId;
  std::string pluginPath;
  std::string componentId;

  DlHandle lib = nullptr;
  IPluginFactory* factory = nullptr;
  IComponent* component = nullptr;
  IAudioProcessor* processor = nullptr;
  IEditController* controller = nullptr;
  IPlugView* plugView = nullptr;

  ProcessSetup processSetup = {};
  bool active = false;
  std::mutex mutex;

  // Audio buffers for one stereo in/out block
  static constexpr int kMaxChannels = 2;
  static constexpr int kMaxBlockSize = 4096;
  float inputData[kMaxChannels][kMaxBlockSize] = {};
  float outputData[kMaxChannels][kMaxBlockSize] = {};
  float* inputPtrs[kMaxChannels] = {};
  float* outputPtrs[kMaxChannels] = {};
};

// Converts a 16-byte TUID to a hex string (uppercase, no dashes)
inline std::string tuidToHex(const TUID& id) {
  char buf[33];
  for (int i = 0; i < 16; ++i)
    snprintf(&buf[i*2], 3, "%02X", id.data[i]);
  buf[32] = '\0';
  return std::string(buf);
}

// Converts a TChar (char16_t / wchar_t) string to std::string (UTF-8 approximation)
inline std::string tcharToString(const TChar* str) {
  if (!str) return "";
  std::string out;
  while (*str) {
    TChar c = *str++;
    if (c < 0x80) out += (char)c;
    else if (c < 0x800) {
      out += (char)(0xC0 | (c >> 6));
      out += (char)(0x80 | (c & 0x3F));
    } else {
      out += (char)(0xE0 | (c >> 12));
      out += (char)(0x80 | ((c >> 6) & 0x3F));
      out += (char)(0x80 | (c & 0x3F));
    }
  }
  return out;
}

// Parses a 32-char hex CID string to a null-terminated C string suitable for
// IPluginFactory::createInstance (which takes a "com.xxx" style string in VST3
// practice, but some SDKs accept the hex form; we pass both).
inline std::string hexCidToFactoryString(const std::string& hex) {
  // Many VST3 factories expect the raw bytes as a C string of exactly 16 chars.
  // We construct that here from the hex representation.
  if (hex.size() < 32) return hex;
  std::string raw(16, '\0');
  for (int i = 0; i < 16; ++i) {
    unsigned int byte = 0;
    sscanf(&hex[i*2], "%2X", &byte);
    raw[i] = (char)byte;
  }
  return raw;
}

class Vst3Host {
public:
  // Singleton
  static Vst3Host& instance() {
    static Vst3Host inst;
    return inst;
  }

  // Resolve the platform binary inside a .vst3 bundle.
  std::string resolveBinary(const std::string& bundlePath) const;

  // Open the DLL and call GetPluginFactory(); enumerate classes.
  // Returns the plugin info for the first audio module class found.
  // Returns empty Vst3PluginInfo with name="" on failure; sets error.
  Vst3PluginInfo scanPlugin(const std::string& bundlePath, std::string& error) const;

  // Create a plugin instance; returns an instanceId or "" on failure.
  std::string createInstance(const std::string& pluginPath,
                             const std::string& componentId,
                             std::string& error);

  void destroyInstance(const std::string& instanceId);

  // Returns false on failure; sets error.
  bool setupProcessing(const std::string& instanceId,
                       int32_t sampleRate,
                       int32_t maxBlockSize,
                       int32_t symbolicSampleSize,
                       int32_t processMode,
                       std::string& error);

  bool activateInstance(const std::string& instanceId, bool active, std::string& error);

  // Process a block of audio. inputChannels and outputChannels are interleaved
  // buffers; channelCount is per bus. Returns false on error.
  bool processBlock(const std::string& instanceId,
                    const std::vector<std::vector<float>>& inputs,
                    std::vector<std::vector<float>>& outputs,
                    int32_t numSamples,
                    std::string& error);

  int32_t getParameterCount(const std::string& instanceId, std::string& error);
  bool getParameterInfo(const std::string& instanceId, int32_t index,
                        ParamInfo& out, std::string& error);
  double getParameterValue(const std::string& instanceId, uint32_t paramId, std::string& error);
  bool setParameterValue(const std::string& instanceId, uint32_t paramId,
                         double value, std::string& error);
  bool getAllParameterValues(const std::string& instanceId,
                             std::vector<std::pair<uint32_t, double>>& out,
                             std::string& error);

  bool getState(const std::string& instanceId, std::vector<uint8_t>& out, std::string& error);
  bool setState(const std::string& instanceId, const std::vector<uint8_t>& data, std::string& error);

  // attachEditor returns {width, height}; parentHandle is the native window handle.
  bool attachEditor(const std::string& instanceId,
                    void* parentHandle,
                    int& width, int& height,
                    std::string& error);
  bool detachEditor(const std::string& instanceId, std::string& error);
  bool resizeEditor(const std::string& instanceId, int width, int height, std::string& error);

  bool sendMidi(const std::string& instanceId, int type, int channel,
                int note, int velocity, int cc, double pitchBend,
                std::string& error);

  bool getPresetCount(const std::string& instanceId, int& count, std::string& error);
  bool getPresetName(const std::string& instanceId, int index,
                     std::string& name, std::string& error);
  bool loadPreset(const std::string& instanceId, const std::string& path, std::string& error);
  bool savePreset(const std::string& instanceId, const std::string& path, std::string& error);

private:
  Vst3Host() = default;
  ~Vst3Host() = default;
  Vst3Host(const Vst3Host&) = delete;
  Vst3Host& operator=(const Vst3Host&) = delete;

  std::map<std::string, std::shared_ptr<Vst3Instance>> instances_;
  std::mutex instancesMutex_;

  std::shared_ptr<Vst3Instance> findInstance(const std::string& id) const;

  // Open the binary and return factory + lib handle; caller owns them.
  static IPluginFactory* openFactory(const std::string& binaryPath,
                                     DlHandle& libOut,
                                     std::string& error);

  static std::string generateId();
};
