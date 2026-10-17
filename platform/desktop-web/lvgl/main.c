#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "lvgl.h"

#define MAIAOS_WIDTH 1280
#define MAIAOS_HEIGHT 720
#define MAIAOS_BUFFER_ROWS 48
#define MAIAOS_OBJECT_LIMIT 512
#define MAIAOS_TEXT_LIMIT 4096

static uint8_t draw_buffer[MAIAOS_WIDTH * MAIAOS_BUFFER_ROWS * 2];
static lv_obj_t *objects[MAIAOS_OBJECT_LIMIT];
static uint8_t object_kinds[MAIAOS_OBJECT_LIMIT];
static lv_coord_t next_label_y[MAIAOS_OBJECT_LIMIT];
static uint8_t button_count[MAIAOS_OBJECT_LIMIT];
static int32_t pointer_x;
static int32_t pointer_y;
static int pointer_state;
static int pending_key;
static int keyboard_state;

EM_JS(void, maiaos_send_flush, (int32_t x, int32_t y, int32_t width, int32_t height, uint32_t pixels), {
  if (typeof Module.onLvglFlush !== "function") {
    throw new Error("LVGL flush callback was not provided by the platform wrapper");
  }
  const length = width * height * 2;
  Module.onLvglFlush(x, y, width, height, HEAPU8.slice(pixels, pixels + length));
});

EM_JS(void, maiaos_send_event, (int32_t handle), {
  if (typeof Module.onMaiaEvent !== "function") {
    throw new Error("LVGL input event callback was not provided by the platform wrapper");
  }
  Module.onMaiaEvent(handle);
});

static uint32_t next_handle = 1;

enum {
  OBJECT_WINDOW = 1,
  OBJECT_LABEL = 2,
  OBJECT_BUTTON = 3
};

static uint32_t tick_milliseconds(void)
{
  return (uint32_t)emscripten_get_now();
}

static void display_flush(lv_display_t *display, const lv_area_t *area, uint8_t *pixels)
{
  int32_t width = area->x2 - area->x1 + 1;
  int32_t height = area->y2 - area->y1 + 1;
  maiaos_send_flush(area->x1, area->y1, width, height, (uint32_t)pixels);
  lv_display_flush_ready(display);
}

static lv_obj_t *get_object(int32_t handle)
{
  if (handle <= 0 || handle >= MAIAOS_OBJECT_LIMIT) return NULL;
  return objects[handle];
}

static int32_t store_object(lv_obj_t *object, uint8_t kind)
{
  while (next_handle < MAIAOS_OBJECT_LIMIT && objects[next_handle] != NULL) next_handle++;
  if (next_handle >= MAIAOS_OBJECT_LIMIT) return -4;
  objects[next_handle] = object;
  object_kinds[next_handle] = kind;
  return (int32_t)next_handle++;
}

static char *copy_guest_text(int32_t pointer, int32_t length)
{
  if (pointer < 0 || length < 0 || length > MAIAOS_TEXT_LIMIT) return NULL;
  char *text = (char *)malloc((size_t)length + 1);
  if (text == NULL) return NULL;
  memcpy(text, (const void *)(uintptr_t)(uint32_t)pointer, (size_t)length);
  text[length] = '\0';
  return text;
}

static void pointer_read(lv_indev_t *indev, lv_indev_data_t *data)
{
  (void)indev;
  data->point.x = (lv_coord_t)pointer_x;
  data->point.y = (lv_coord_t)pointer_y;
  data->continue_reading = false;
  if (pointer_state == 1 || pointer_state == 2 || pointer_state == 4) {
    data->state = LV_INDEV_STATE_PRESSED;
    pointer_state = pointer_state == 4 ? 3 : 2;
    data->continue_reading = pointer_state == 3;
  } else {
    data->state = LV_INDEV_STATE_RELEASED;
    if (pointer_state == 3) pointer_state = 0;
  }
}

static void keyboard_read(lv_indev_t *indev, lv_indev_data_t *data)
{
  (void)indev;
  data->key = (uint32_t)pending_key;
  data->continue_reading = false;
  if (keyboard_state == 1 || keyboard_state == 2 || keyboard_state == 4) {
    data->state = LV_INDEV_STATE_PRESSED;
    keyboard_state = keyboard_state == 4 ? 3 : 2;
    data->continue_reading = keyboard_state == 3;
  } else {
    data->state = LV_INDEV_STATE_RELEASED;
    if (keyboard_state == 3) {
      keyboard_state = 0;
      pending_key = 0;
    }
  }
}

void EMSCRIPTEN_KEEPALIVE maiaos_lvgl_tick(void)
{
  lv_timer_handler();
}

static void button_event(lv_event_t *event)
{
  if (lv_event_get_code(event) == LV_EVENT_CLICKED) {
    int32_t handle = (int32_t)(intptr_t)lv_event_get_user_data(event);
    maiaos_send_event(handle);
  }
}

void EMSCRIPTEN_KEEPALIVE maiaos_lvgl_pointer(int32_t x, int32_t y, int pressed)
{
  pointer_x = x;
  pointer_y = y;
  if (pressed) {
    if (pointer_state == 0 || pointer_state == 3) pointer_state = 1;
  } else if (pointer_state == 1) {
    pointer_state = 4;
  } else if (pointer_state == 2) {
    pointer_state = 3;
  }
}

void EMSCRIPTEN_KEEPALIVE maiaos_lvgl_key(int key, int pressed)
{
  if (pressed) {
    pending_key = key == 1 ? LV_KEY_ENTER : key == 2 ? LV_KEY_NEXT : LV_KEY_ESC;
    if (keyboard_state == 0 || keyboard_state == 3) keyboard_state = 1;
  } else if (keyboard_state == 1) {
    keyboard_state = 4;
  } else if (keyboard_state == 2) {
    keyboard_state = 3;
  }
}

void EMSCRIPTEN_KEEPALIVE maiaos_lvgl_reset(void)
{
  lv_obj_clean(lv_screen_active());
  memset(objects, 0, sizeof(objects));
  memset(object_kinds, 0, sizeof(object_kinds));
  memset(next_label_y, 0, sizeof(next_label_y));
  memset(button_count, 0, sizeof(button_count));
  next_handle = 1;
}

int32_t EMSCRIPTEN_KEEPALIVE maiaos_lvgl_window_create(int32_t pointer, int32_t length)
{
  char *title_text = copy_guest_text(pointer, length);
  if (title_text == NULL) return -1;

  lv_obj_t *window = lv_obj_create(lv_screen_active());
  lv_obj_set_size(window, 920, 590);
  lv_obj_align(window, LV_ALIGN_CENTER, 0, 18);
  lv_obj_set_style_bg_color(window, lv_color_hex(0x1b252b), LV_PART_MAIN);
  lv_obj_set_style_border_color(window, lv_color_hex(0x45635c), LV_PART_MAIN);
  lv_obj_set_style_pad_all(window, 28, LV_PART_MAIN);

  lv_obj_t *title = lv_label_create(window);
  lv_label_set_text(title, title_text);
  lv_obj_set_style_text_font(title, &lv_font_montserrat_32, LV_PART_MAIN);
  lv_obj_set_style_text_color(title, lv_color_hex(0x74d5b4), LV_PART_MAIN);
  lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 12);
  free(title_text);

  int32_t handle = store_object(window, OBJECT_WINDOW);
  if (handle > 0) next_label_y[handle] = 86;
  return handle;
}

int32_t EMSCRIPTEN_KEEPALIVE maiaos_lvgl_label_create(int32_t parent_handle, int32_t pointer, int32_t length)
{
  lv_obj_t *parent = get_object(parent_handle);
  char *text = copy_guest_text(pointer, length);
  if (parent == NULL || text == NULL) {
    free(text);
    return -1;
  }

  lv_obj_t *label = lv_label_create(parent);
  lv_label_set_text(label, text);
  lv_obj_set_style_text_color(label, lv_color_hex(0xe8f2ef), LV_PART_MAIN);
  lv_obj_align(label, LV_ALIGN_TOP_LEFT, 24, next_label_y[parent_handle]);
  next_label_y[parent_handle] += 38;
  free(text);
  return store_object(label, OBJECT_LABEL);
}

int32_t EMSCRIPTEN_KEEPALIVE maiaos_lvgl_label_set_text(int32_t handle, int32_t pointer, int32_t length)
{
  lv_obj_t *label = get_object(handle);
  if (label == NULL || object_kinds[handle] != OBJECT_LABEL) return -7;
  char *text = copy_guest_text(pointer, length);
  if (text == NULL) return -1;
  lv_label_set_text(label, text);
  lv_obj_set_style_text_color(label, lv_color_hex(0xe8f2ef), LV_PART_MAIN);
  free(text);
  return 0;
}

int32_t EMSCRIPTEN_KEEPALIVE maiaos_lvgl_button_create(int32_t parent_handle, int32_t pointer, int32_t length)
{
  lv_obj_t *parent = get_object(parent_handle);
  char *text = copy_guest_text(pointer, length);
  if (parent == NULL || text == NULL) {
    free(text);
    return -1;
  }

  lv_obj_t *button = lv_button_create(parent);
  lv_obj_set_size(button, 280, 64);
  lv_obj_align(button, LV_ALIGN_BOTTOM_MID, 0, -28 - (button_count[parent_handle] * 76));
  button_count[parent_handle]++;
  int32_t handle = store_object(button, OBJECT_BUTTON);
  if (handle <= 0) {
    lv_obj_delete(button);
    free(text);
    return handle;
  }
  lv_obj_add_event_cb(button, button_event, LV_EVENT_CLICKED, (void *)(intptr_t)handle);
  lv_group_add_obj(lv_group_get_default(), button);

  lv_obj_t *label = lv_label_create(button);
  lv_label_set_text(label, text);
  lv_obj_center(label);
  free(text);
  return handle;
}

static int is_descendant_of(lv_obj_t *object, lv_obj_t *ancestor)
{
  while (object != NULL) {
    if (object == ancestor) return 1;
    object = lv_obj_get_parent(object);
  }
  return 0;
}

int32_t EMSCRIPTEN_KEEPALIVE maiaos_lvgl_object_destroy(int32_t handle)
{
  lv_obj_t *object = get_object(handle);
  if (object == NULL) return -7;
  for (uint32_t i = 1; i < next_handle; i++) {
    if (objects[i] != NULL && is_descendant_of(objects[i], object)) {
      objects[i] = NULL;
      object_kinds[i] = 0;
    }
  }
  lv_obj_delete(object);
  return 0;
}

int main(void)
{
  lv_init();
  lv_tick_set_cb(tick_milliseconds);

  lv_display_t *display = lv_display_create(MAIAOS_WIDTH, MAIAOS_HEIGHT);
  lv_display_set_color_format(display, LV_COLOR_FORMAT_RGB565);
  lv_display_set_buffers(display, draw_buffer, NULL, sizeof(draw_buffer), LV_DISPLAY_RENDER_MODE_PARTIAL);
  lv_display_set_flush_cb(display, display_flush);

  lv_indev_t *pointer = lv_indev_create();
  lv_indev_set_type(pointer, LV_INDEV_TYPE_POINTER);
  lv_indev_set_read_cb(pointer, pointer_read);

  lv_group_t *group = lv_group_create();
  lv_group_set_default(group);
  lv_indev_t *keyboard = lv_indev_create();
  lv_indev_set_type(keyboard, LV_INDEV_TYPE_KEYPAD);
  lv_indev_set_read_cb(keyboard, keyboard_read);
  lv_indev_set_group(keyboard, group);

  return 0;
}
