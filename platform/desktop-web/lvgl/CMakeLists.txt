cmake_minimum_required(VERSION 3.20)
project(maiaos_lvgl_browser C)

if(NOT CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
  message(FATAL_ERROR "Build this target with emcmake; this is the LVGL browser-WASM host, not the Node guest runtime.")
endif()

include(FetchContent)
set(LV_BUILD_CONF_PATH "${CMAKE_CURRENT_SOURCE_DIR}/lv_conf.h" CACHE PATH "MaiaOS LVGL config" FORCE)
set(LV_BUILD_LVGL_H_SIMPLE_INCLUDE ON CACHE BOOL "Use the simple LVGL header include" FORCE)
set(CONFIG_LV_BUILD_DEMOS OFF CACHE BOOL "Do not compile upstream demo applications" FORCE)
set(CONFIG_LV_BUILD_EXAMPLES OFF CACHE BOOL "Do not compile upstream example applications" FORCE)
set(CONFIG_LV_USE_THORVG_INTERNAL OFF CACHE BOOL "Use the software renderer only" FORCE)

if(MAIAOS_LVGL_SOURCE_DIR)
  set(MAIAOS_LVGL_ROOT "${MAIAOS_LVGL_SOURCE_DIR}")
  add_subdirectory("${MAIAOS_LVGL_SOURCE_DIR}" "${CMAKE_BINARY_DIR}/lvgl")
else()
  FetchContent_Declare(
    lvgl
    GIT_REPOSITORY https://github.com/lvgl/lvgl.git
    GIT_TAG v9.3.0
    GIT_SHALLOW TRUE
  )
  FetchContent_MakeAvailable(lvgl)
  set(MAIAOS_LVGL_ROOT "${lvgl_SOURCE_DIR}")
endif()

add_executable(maiaos-lvgl main.c)
target_link_libraries(maiaos-lvgl PRIVATE lvgl)
target_include_directories(maiaos-lvgl PRIVATE "${MAIAOS_LVGL_ROOT}")
target_compile_definitions(maiaos-lvgl PRIVATE LV_CONF_INCLUDE_SIMPLE)
target_compile_options(maiaos-lvgl PRIVATE -O2 -Wall -Wextra)
set_target_properties(maiaos-lvgl PROPERTIES
  OUTPUT_NAME "maiaos-lvgl"
  SUFFIX ".js"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../generated"
)
target_link_options(maiaos-lvgl PRIVATE
  "-sMODULARIZE=1"
  "-sEXPORT_NAME=createMaiaOsLvgl"
  "-sEXPORT_ES6=1"
  "-sENVIRONMENT=web,node"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sNO_EXIT_RUNTIME=1"
  "-sEXPORTED_FUNCTIONS=['_main','_maiaos_lvgl_tick','_maiaos_lvgl_pointer','_maiaos_lvgl_key','_maiaos_lvgl_reset','_maiaos_lvgl_window_create','_maiaos_lvgl_label_create','_maiaos_lvgl_label_set_text','_maiaos_lvgl_button_create','_maiaos_lvgl_object_destroy','_malloc','_free']"
  "-sEXPORTED_RUNTIME_METHODS=['stringToUTF8']"
)
