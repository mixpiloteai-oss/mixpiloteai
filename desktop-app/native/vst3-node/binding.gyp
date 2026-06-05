{
  "targets": [
    {
      "target_name": "vst3-node",
      "sources": [
        "src/vst3_host.cc",
        "src/vst3_addon.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags_cc": ["-std=c++17", "-fexceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": ["/std:c++17"]
            }
          },
          "libraries": ["kernel32.lib"]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "MACOSX_DEPLOYMENT_TARGET": "10.14"
          },
          "libraries": ["-framework CoreFoundation", "-ldl"]
        }],
        ["OS=='linux'", {
          "libraries": ["-ldl"],
          "cflags_cc": ["-std=c++17", "-fexceptions", "-Wno-cast-function-type"]
        }]
      ]
    }
  ]
}
