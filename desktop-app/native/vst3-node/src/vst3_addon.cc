// ── vst3_addon.cc ─────────────────────────────────────────────────────────────
// N-API bindings: exposes Vst3Host methods to Node.js / Electron.
// Compiled with node-gyp. Requires node-addon-api.
// ─────────────────────────────────────────────────────────────────────────────

#include <napi.h>
#include "vst3_host.h"

// ── Helper: throw JS Error from C++ error string ─────────────────────────────

static Napi::Value throwError(Napi::Env env, const std::string& msg) {
  Napi::TypeError::New(env, msg).ThrowAsJavaScriptException();
  return env.Undefined();
}

// ── scanPlugin(bundlePath: string): object | null ────────────────────────────

static Napi::Value ScanPlugin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    return throwError(env, "scanPlugin: expected string bundlePath");

  std::string bundlePath = info[0].As<Napi::String>().Utf8Value();
  std::string error;
  Vst3PluginInfo pi = Vst3Host::instance().scanPlugin(bundlePath, error);

  if (pi.name.empty()) {
    // Return null on failure (not an exception — caller checks for null)
    return env.Null();
  }

  Napi::Object obj = Napi::Object::New(env);
  obj.Set("cid",                 Napi::String::New(env, pi.cid));
  obj.Set("name",                Napi::String::New(env, pi.name));
  obj.Set("vendor",              Napi::String::New(env, pi.vendor));
  obj.Set("version",             Napi::String::New(env, pi.version));
  obj.Set("sdkVersion",          Napi::String::New(env, pi.sdkVersion));
  obj.Set("category",            Napi::String::New(env, pi.category));
  obj.Set("hasEditor",           Napi::Boolean::New(env, pi.hasEditor));
  obj.Set("parameterCount",      Napi::Number::New(env, pi.parameterCount));
  obj.Set("inputBusCount",       Napi::Number::New(env, pi.inputBusCount));
  obj.Set("outputBusCount",      Napi::Number::New(env, pi.outputBusCount));
  obj.Set("supportsMidi",        Napi::Boolean::New(env, pi.supportsMidi));
  obj.Set("supportsMultipleOutputs", Napi::Boolean::New(env, pi.supportsMultiOut));
  obj.Set("programCount",        Napi::Number::New(env, pi.programCount));

  Napi::Array subCats = Napi::Array::New(env, pi.subCategories.size());
  for (size_t i = 0; i < pi.subCategories.size(); ++i)
    subCats.Set((uint32_t)i, Napi::String::New(env, pi.subCategories[i]));
  obj.Set("subCategories", subCats);

  return obj;
}

// ── createInstance(bundlePath, componentId): string ───────────────────────────

static Napi::Value CreateInstance(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString())
    return throwError(env, "createInstance: expected (bundlePath: string, componentId: string)");

  std::string bundlePath   = info[0].As<Napi::String>().Utf8Value();
  std::string componentId  = info[1].As<Napi::String>().Utf8Value();
  std::string error;

  std::string instanceId = Vst3Host::instance().createInstance(bundlePath, componentId, error);
  if (instanceId.empty())
    return throwError(env, "createInstance failed: " + error);

  return Napi::String::New(env, instanceId);
}

// ── destroyInstance(instanceId): void ────────────────────────────────────────

static Napi::Value DestroyInstance(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    return throwError(env, "destroyInstance: expected string instanceId");

  Vst3Host::instance().destroyInstance(info[0].As<Napi::String>().Utf8Value());
  return env.Undefined();
}

// ── setupProcessing(instanceId, setup): bool ─────────────────────────────────

static Napi::Value SetupProcessing(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsObject())
    return throwError(env, "setupProcessing: expected (instanceId: string, setup: object)");

  std::string instanceId = info[0].As<Napi::String>().Utf8Value();
  Napi::Object setup     = info[1].As<Napi::Object>();

  int32_t sampleRate          = setup.Get("sampleRate").As<Napi::Number>().Int32Value();
  int32_t maxBlockSize        = setup.Get("maxBlockSize").As<Napi::Number>().Int32Value();
  int32_t symbolicSampleSize  = setup.Has("symbolicSampleSize")
    ? setup.Get("symbolicSampleSize").As<Napi::Number>().Int32Value() : 0;
  int32_t processMode         = setup.Has("processMode")
    ? setup.Get("processMode").As<Napi::Number>().Int32Value() : 0;

  std::string error;
  bool ok = Vst3Host::instance().setupProcessing(instanceId, sampleRate, maxBlockSize,
                                                  symbolicSampleSize, processMode, error);
  if (!ok) return throwError(env, "setupProcessing failed: " + error);
  return Napi::Boolean::New(env, true);
}

// ── activateInstance(instanceId, active): void ───────────────────────────────

static Napi::Value ActivateInstance(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsBoolean())
    return throwError(env, "activateInstance: expected (instanceId: string, active: boolean)");

  std::string instanceId = info[0].As<Napi::String>().Utf8Value();
  bool active            = info[1].As<Napi::Boolean>().Value();
  std::string error;

  if (!Vst3Host::instance().activateInstance(instanceId, active, error))
    return throwError(env, "activateInstance failed: " + error);
  return env.Undefined();
}

// ── processBlock(instanceId, inputs, outputs, events): void ──────────────────
// inputs / outputs: Array<Float32Array> (one per channel)
// events: ignored for now (TODO: wire IEventList)

static Napi::Value ProcessBlock(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsArray() || !info[2].IsArray())
    return throwError(env, "processBlock: expected (instanceId, inputs: Float32Array[], outputs: Float32Array[])");

  std::string instanceId = info[0].As<Napi::String>().Utf8Value();
  Napi::Array inArr  = info[1].As<Napi::Array>();
  Napi::Array outArr = info[2].As<Napi::Array>();

  std::vector<std::vector<float>> inputs(inArr.Length());
  for (uint32_t ch = 0; ch < inArr.Length(); ++ch) {
    Napi::Float32Array fa = inArr.Get(ch).As<Napi::Float32Array>();
    inputs[ch].assign(fa.Data(), fa.Data() + fa.ElementLength());
  }

  // numSamples from first input channel
  int32_t numSamples = inputs.empty() ? 0 : (int32_t)inputs[0].size();

  std::vector<std::vector<float>> outputs(outArr.Length());
  for (uint32_t ch = 0; ch < outArr.Length(); ++ch) {
    Napi::Float32Array fa = outArr.Get(ch).As<Napi::Float32Array>();
    outputs[ch].resize(numSamples);
  }

  std::string error;
  if (!Vst3Host::instance().processBlock(instanceId, inputs, outputs, numSamples, error))
    return throwError(env, "processBlock failed: " + error);

  // Write output back into the passed Float32Arrays
  for (uint32_t ch = 0; ch < outArr.Length() && ch < outputs.size(); ++ch) {
    Napi::Float32Array fa = outArr.Get(ch).As<Napi::Float32Array>();
    int32_t len = std::min((int32_t)fa.ElementLength(), numSamples);
    std::memcpy(fa.Data(), outputs[ch].data(), len * sizeof(float));
  }

  return env.Undefined();
}

// ── getParameterCount(instanceId): number ────────────────────────────────────

static Napi::Value GetParameterCount(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    return throwError(env, "getParameterCount: expected string instanceId");

  std::string error;
  int32_t count = Vst3Host::instance().getParameterCount(
    info[0].As<Napi::String>().Utf8Value(), error);
  return Napi::Number::New(env, count);
}

// ── getParameterInfo(instanceId, index): object ──────────────────────────────

static Napi::Value GetParameterInfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber())
    return throwError(env, "getParameterInfo: expected (instanceId: string, index: number)");

  std::string instanceId = info[0].As<Napi::String>().Utf8Value();
  int32_t index = info[1].As<Napi::Number>().Int32Value();
  ParamInfo pi;
  std::string error;

  if (!Vst3Host::instance().getParameterInfo(instanceId, index, pi, error))
    return throwError(env, "getParameterInfo failed: " + error);

  Napi::Object obj = Napi::Object::New(env);
  obj.Set("id",                    Napi::Number::New(env, pi.id));
  obj.Set("title",                 Napi::String::New(env, pi.title));
  obj.Set("shortTitle",            Napi::String::New(env, pi.shortTitle));
  obj.Set("units",                 Napi::String::New(env, pi.units));
  obj.Set("stepCount",             Napi::Number::New(env, pi.stepCount));
  obj.Set("defaultNormalizedValue",Napi::Number::New(env, pi.defaultNormalizedValue));
  obj.Set("unitId",                Napi::Number::New(env, pi.unitId));
  obj.Set("flags",                 Napi::Number::New(env, pi.flags));
  return obj;
}

// ── getParameterValue(instanceId, paramId): number ───────────────────────────

static Napi::Value GetParameterValue(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber())
    return throwError(env, "getParameterValue: expected (instanceId: string, paramId: number)");

  std::string error;
  double val = Vst3Host::instance().getParameterValue(
    info[0].As<Napi::String>().Utf8Value(),
    info[1].As<Napi::Number>().Uint32Value(),
    error);
  return Napi::Number::New(env, val);
}

// ── setParameterValue(instanceId, paramId, value): void ──────────────────────

static Napi::Value SetParameterValue(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber())
    return throwError(env, "setParameterValue: expected (instanceId, paramId, value)");

  std::string error;
  if (!Vst3Host::instance().setParameterValue(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::Number>().Uint32Value(),
        info[2].As<Napi::Number>().DoubleValue(),
        error))
    return throwError(env, "setParameterValue failed: " + error);
  return env.Undefined();
}

// ── getParameterStringByValue(instanceId, paramId, value): string ─────────────

static Napi::Value GetParameterStringByValue(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3)
    return throwError(env, "getParameterStringByValue: expected (instanceId, paramId, value)");
  // Simplified: return numeric string (full impl needs IEditController::getParamStringByValue)
  double val = info[2].As<Napi::Number>().DoubleValue();
  char buf[32];
  snprintf(buf, sizeof(buf), "%.3f", val);
  return Napi::String::New(env, buf);
}

// ── getAllParameterValues(instanceId): Array<{paramId, value}> ────────────────

static Napi::Value GetAllParameterValues(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    return throwError(env, "getAllParameterValues: expected string instanceId");

  std::string error;
  std::vector<std::pair<uint32_t, double>> vals;
  if (!Vst3Host::instance().getAllParameterValues(
        info[0].As<Napi::String>().Utf8Value(), vals, error))
    return throwError(env, "getAllParameterValues failed: " + error);

  Napi::Array arr = Napi::Array::New(env, vals.size());
  for (size_t i = 0; i < vals.size(); ++i) {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("paramId",    Napi::Number::New(env, vals[i].first));
    obj.Set("value",      Napi::Number::New(env, vals[i].second));
    obj.Set("normalized", Napi::Number::New(env, vals[i].second));
    char buf[32]; snprintf(buf, sizeof(buf), "%.3f", vals[i].second);
    obj.Set("display", Napi::String::New(env, buf));
    arr.Set((uint32_t)i, obj);
  }
  return arr;
}

// ── getState(instanceId): Buffer ─────────────────────────────────────────────

static Napi::Value GetState(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    return throwError(env, "getState: expected string instanceId");

  std::string error;
  std::vector<uint8_t> data;
  if (!Vst3Host::instance().getState(info[0].As<Napi::String>().Utf8Value(), data, error))
    return throwError(env, "getState failed: " + error);

  return Napi::Buffer<uint8_t>::Copy(env, data.data(), data.size());
}

// ── setState(instanceId, buffer): void ───────────────────────────────────────

static Napi::Value SetState(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsBuffer())
    return throwError(env, "setState: expected (instanceId: string, state: Buffer)");

  std::string instanceId = info[0].As<Napi::String>().Utf8Value();
  Napi::Buffer<uint8_t> buf = info[1].As<Napi::Buffer<uint8_t>>();
  std::vector<uint8_t> data(buf.Data(), buf.Data() + buf.Length());
  std::string error;

  if (!Vst3Host::instance().setState(instanceId, data, error))
    return throwError(env, "setState failed: " + error);
  return env.Undefined();
}

// ── attachEditor(instanceId, parentWindowHandle: Buffer): {width, height} ────

static Napi::Value AttachEditor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsBuffer())
    return throwError(env, "attachEditor: expected (instanceId: string, parentHandle: Buffer)");

  std::string instanceId = info[0].As<Napi::String>().Utf8Value();
  Napi::Buffer<uint8_t> handle = info[1].As<Napi::Buffer<uint8_t>>();

  // The buffer contains the native window handle as a pointer-sized value
  void* parentHandle = nullptr;
  if (handle.Length() >= sizeof(void*))
    std::memcpy(&parentHandle, handle.Data(), sizeof(void*));

  int width = 800, height = 600;
  std::string error;
  if (!Vst3Host::instance().attachEditor(instanceId, parentHandle, width, height, error))
    return throwError(env, "attachEditor failed: " + error);

  Napi::Object obj = Napi::Object::New(env);
  obj.Set("width",  Napi::Number::New(env, width));
  obj.Set("height", Napi::Number::New(env, height));
  return obj;
}

// ── detachEditor(instanceId): void ───────────────────────────────────────────

static Napi::Value DetachEditor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    return throwError(env, "detachEditor: expected string instanceId");

  std::string error;
  if (!Vst3Host::instance().detachEditor(info[0].As<Napi::String>().Utf8Value(), error))
    return throwError(env, "detachEditor failed: " + error);
  return env.Undefined();
}

// ── resizeEditor(instanceId, width, height): void ────────────────────────────

static Napi::Value ResizeEditor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber())
    return throwError(env, "resizeEditor: expected (instanceId, width, height)");

  std::string error;
  if (!Vst3Host::instance().resizeEditor(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::Number>().Int32Value(),
        info[2].As<Napi::Number>().Int32Value(),
        error))
    return throwError(env, "resizeEditor failed: " + error);
  return env.Undefined();
}

// ── sendMidiEvent(instanceId, event): void ───────────────────────────────────

static Napi::Value SendMidiEvent(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsObject())
    return throwError(env, "sendMidiEvent: expected (instanceId: string, event: object)");

  std::string instanceId = info[0].As<Napi::String>().Utf8Value();
  Napi::Object ev        = info[1].As<Napi::Object>();

  std::string typeStr = ev.Has("type") ? ev.Get("type").As<Napi::String>().Utf8Value() : "";
  int channel  = ev.Has("channel")  ? ev.Get("channel").As<Napi::Number>().Int32Value()  : 0;
  int note     = ev.Has("note")     ? ev.Get("note").As<Napi::Number>().Int32Value()     : 0;
  int velocity = ev.Has("velocity") ? ev.Get("velocity").As<Napi::Number>().Int32Value() : 0;
  int cc       = ev.Has("ccNumber") ? ev.Get("ccNumber").As<Napi::Number>().Int32Value() : 0;
  double pitch = ev.Has("pitchBend")? ev.Get("pitchBend").As<Napi::Number>().DoubleValue(): 0.0;

  int type = 0; // encode type for C++
  if      (typeStr == "noteOn")   type = 0;
  else if (typeStr == "noteOff")  type = 1;
  else if (typeStr == "cc")       type = 2;
  else if (typeStr == "pitchBend")type = 3;

  std::string error;
  if (!Vst3Host::instance().sendMidi(instanceId, type, channel, note, velocity, cc, pitch, error))
    return throwError(env, "sendMidiEvent failed: " + error);
  return env.Undefined();
}

// ── getPresetCount / getPresetName / loadPreset / savePreset ──────────────────

static Napi::Value GetPresetCount(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString())
    return throwError(env, "getPresetCount: expected string instanceId");
  int count = 0;
  std::string error;
  Vst3Host::instance().getPresetCount(info[0].As<Napi::String>().Utf8Value(), count, error);
  return Napi::Number::New(env, count);
}

static Napi::Value GetPresetName(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber())
    return throwError(env, "getPresetName: expected (instanceId, index)");
  std::string name, error;
  Vst3Host::instance().getPresetName(
    info[0].As<Napi::String>().Utf8Value(),
    info[1].As<Napi::Number>().Int32Value(),
    name, error);
  return Napi::String::New(env, name);
}

static Napi::Value LoadPreset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString())
    return throwError(env, "loadPreset: expected (instanceId, presetPath)");
  std::string error;
  if (!Vst3Host::instance().loadPreset(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::String>().Utf8Value(),
        error))
    return throwError(env, "loadPreset failed: " + error);
  return env.Undefined();
}

static Napi::Value SavePreset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString())
    return throwError(env, "savePreset: expected (instanceId, presetPath)");
  std::string error;
  if (!Vst3Host::instance().savePreset(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::String>().Utf8Value(),
        error))
    return throwError(env, "savePreset failed: " + error);
  return env.Undefined();
}

// ── Module initialization ─────────────────────────────────────────────────────

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("scanPlugin",               Napi::Function::New(env, ScanPlugin));
  exports.Set("createInstance",           Napi::Function::New(env, CreateInstance));
  exports.Set("destroyInstance",          Napi::Function::New(env, DestroyInstance));
  exports.Set("setupProcessing",          Napi::Function::New(env, SetupProcessing));
  exports.Set("activateInstance",         Napi::Function::New(env, ActivateInstance));
  exports.Set("processBlock",             Napi::Function::New(env, ProcessBlock));
  exports.Set("getParameterCount",        Napi::Function::New(env, GetParameterCount));
  exports.Set("getParameterInfo",         Napi::Function::New(env, GetParameterInfo));
  exports.Set("getParameterValue",        Napi::Function::New(env, GetParameterValue));
  exports.Set("setParameterValue",        Napi::Function::New(env, SetParameterValue));
  exports.Set("getParameterStringByValue",Napi::Function::New(env, GetParameterStringByValue));
  exports.Set("getAllParameterValues",    Napi::Function::New(env, GetAllParameterValues));
  exports.Set("getState",                 Napi::Function::New(env, GetState));
  exports.Set("setState",                 Napi::Function::New(env, SetState));
  exports.Set("attachEditor",             Napi::Function::New(env, AttachEditor));
  exports.Set("detachEditor",             Napi::Function::New(env, DetachEditor));
  exports.Set("resizeEditor",             Napi::Function::New(env, ResizeEditor));
  exports.Set("sendMidiEvent",            Napi::Function::New(env, SendMidiEvent));
  exports.Set("getPresetCount",           Napi::Function::New(env, GetPresetCount));
  exports.Set("getPresetName",            Napi::Function::New(env, GetPresetName));
  exports.Set("loadPreset",               Napi::Function::New(env, LoadPreset));
  exports.Set("savePreset",              Napi::Function::New(env, SavePreset));
  return exports;
}

NODE_API_MODULE(vst3_node, Init)
