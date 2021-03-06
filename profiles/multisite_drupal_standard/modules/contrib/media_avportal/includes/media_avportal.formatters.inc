<?php

/**
 * @file
 * Formatters for Media: Avportal.
 */

/**
 * Implements hook_file_formatter_info().
 */
function media_avportal_file_formatter_info() {
  $formatters['media_avportal_video'] = array(
    'label' => t('AV Portal Video'),
    'file types' => array('video'),
    'default settings' => array(),
    'view callback' => 'media_avportal_file_formatter_video_view',
    'settings callback' => 'media_avportal_file_formatter_video_settings',
  );

  foreach (array('width', 'height') as $setting) {
    $formatters['media_avportal_video']['default settings'][$setting] = media_avportal_variable_get($setting);
  }

  $formatters['media_avportal_image'] = array(
    'label' => t('AV Portal Preview Image'),
    'file types' => array('video'),
    'default settings' => array(
      'image_style' => '',
    ),
    'view callback' => 'media_avportal_file_formatter_image_view',
    'settings callback' => 'media_avportal_file_formatter_image_settings',
  );

  return $formatters;
}

/**
 * Implements hook_file_formatter_FORMATTER_view().
 */
function media_avportal_file_formatter_video_view($file, $display) {

  $scheme = file_uri_scheme($file->uri);
  // WYSIWYG does not yet support video inside a running editor instance.
  if ($scheme == 'avportal' && empty($file->override['wysiwyg'])) {
    $options = array();
    // Fake a default for attributes so the ternary doesn't choke.
    $display['settings']['attributes'] = array();

    foreach (array('width', 'height') as $setting) {
      $options[$setting] = isset($file->override[$setting]) ? $file->override[$setting] : $display['settings'][$setting];
    }

    // Let's add the language to the options.
    global $language;
    $wrapper = file_stream_wrapper_get_instance_by_uri($file->uri);
    try {
      $languages = $wrapper->getAvailableVideoLanguage();
    }
    catch (Exception  $e) {
      watchdog_exception('media_avportal', $e);
    }
    $video_language = 'en';
    if (isset($languages) && is_array($languages) && in_array($language->language, $languages)) {
      $video_language = $language->language;
    }
    $options['lg'] = $video_language;

    return array(
      '#theme' => 'media_avportal_video',
      '#uri' => $file->uri,
      '#options' => $options,
    );
  }
}

/**
 * Implements hook_file_formatter_FORMATTER_settings().
 */
function media_avportal_file_formatter_video_settings($form, &$form_state, $settings) {
  $element = array();

  $element['width'] = array(
    '#title' => t('Width'),
    '#type' => 'textfield',
    '#default_value' => $settings['width'],
    '#element_validate' => array('_avportal_validate_video_width_and_height'),
  );
  $element['height'] = array(
    '#title' => t('Height'),
    '#type' => 'textfield',
    '#default_value' => $settings['height'],
    '#element_validate' => array('_avportal_validate_video_width_and_height'),
  );

  return $element;
}

/**
 * Validation for width and height.
 */
function _avportal_validate_video_width_and_height($element, &$form_state, $form) {
  // Check if the value is a number with an optional decimal or
  // percentage sign, or "auto".
  if (!empty($element['#value']) && !preg_match('/^(auto|([0-9]*(\.[0-9]+)?%?))$/', $element['#value'])) {
    form_error($element, t("The value entered for @dimension is invalid. Please insert an unitless integer for pixels, a percent, or 'auto'. Note that percent and auto may not function correctly depending on the browser and doctype.", array('@dimension' => $element['#title'])));
  }
}

/**
 * Implements hook_file_formatter_FORMATTER_view().
 */
function media_avportal_file_formatter_image_view($file, $display) {
  $scheme = file_uri_scheme($file->uri);
  if ($scheme != 'avportal') {
    return;
  }

  $wrapper = file_stream_wrapper_get_instance_by_uri($file->uri);
  $image_style = $display['settings']['image_style'];
  $valid_image_styles = image_style_options(FALSE);
  $path = 'public://media-icons/default/video-x-generic.png';
  if ($wrapper->getLocalThumbnailPath() != NULL) {
    $path = $wrapper->getLocalThumbnailPath();
  }

  if (empty($image_style) || !isset($valid_image_styles[$image_style])) {
    return array(
      '#theme' => 'image',
      '#path' => str_replace('http:', '', $path),
      '#alt' => isset($file->override['attributes']['alt']) ? $file->override['attributes']['alt'] : $file->filename,
    );
  }

  return array(
    '#theme' => 'image_style',
    '#style_name' => $image_style,
    '#path' => $path,
    '#alt' => isset($file->override['attributes']['alt']) ? $file->override['attributes']['alt'] : $file->filename,
  );
}

/**
 * Implements hook_file_formatter_FORMATTER_settings().
 */
function media_avportal_file_formatter_image_settings($form, &$form_state, $settings) {
  $element = array();
  $element['image_style'] = array(
    '#title' => t('Image style'),
    '#type' => 'select',
    '#options' => image_style_options(FALSE),
    '#default_value' => $settings['image_style'],
    '#empty_option' => t('None (original image)'),
  );
  return $element;
}
