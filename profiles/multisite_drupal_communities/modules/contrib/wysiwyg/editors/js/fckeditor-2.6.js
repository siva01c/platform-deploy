(function($) {

/**
 * Attach this editor to a target element.
 */
Drupal.wysiwyg.editor.attach.fckeditor = function(context, params, settings) {
  var $field = $('#' + params.field);
  if (!settings.Height) {
    settings.Height = $field.height();
    if (settings.Height < 60) {
      // Roughly 23px per row + 40 for 1 toolbar row and scrollbar.
      settings.Height = Math.max(settings.Height, Math.max((parseInt($field.attr('rows'), 10) || 2) * 23 + 40, 60));
    };
  }
  var FCKinstance = new FCKeditor(params.field, settings.Width, settings.Height, settings.ToolbarSet);
  // Keep track of the settings for this instance.
  this.editorSettings = settings;
  // Temporarily store the private instance for use in the config file.
  $('#' + params.field, context).data('wysiwygInstance', this);
  // Apply editor instance settings.
  FCKinstance.BasePath = settings.EditorPath;
  FCKinstance.Config.wysiwygFormat = params.format;
  FCKinstance.Config.CustomConfigurationsPath = settings.CustomConfigurationsPath;

  // Load Drupal plugins and apply format specific settings.
  // @see fckeditor.config.js
  // @see Drupal.wysiwyg.editor.instance.fckeditor.init()

  // Attach editor.
  FCKinstance.ReplaceTextarea();
};

/**
 * Detach a single editor instance.
 */
Drupal.wysiwyg.editor.detach.fckeditor = function (context, params, trigger) {
  var instanceName = params.field;
  var instance = FCKeditorAPI.GetInstance(instanceName);
  if (!instance) {
    return;
  }
  instance.UpdateLinkedField();
  if (trigger == 'serialize') {
    // The editor is not being removed from the DOM, so updating the linked
    // field is the only action necessary.
    return;
  }
  // Since we already detach the editor and update the textarea, the submit
  // event handler needs to be removed to prevent data loss (in IE).
  // FCKeditor uses 2 nested iFrames; instance.EditingArea.Window is the
  // deepest. Its parent is the iFrame containing the editor.
  var instanceScope = instance.EditingArea.Window.parent;
  instanceScope.FCKTools.RemoveEventListener(instance.GetParentForm(), 'submit', instance.UpdateLinkedField);
  // Run cleanups before forcing an unload of the iFrames or IE crashes.
  // This also deletes the instance from the FCKeditorAPI.__Instances array.
  instanceScope.FCKTools.RemoveEventListener(instanceScope, 'unload', instanceScope.FCKeditorAPI_Cleanup);
  instanceScope.FCKTools.RemoveEventListener(instanceScope, 'beforeunload', instanceScope.FCKeditorAPI_ConfirmCleanup);
  if (jQuery.isFunction(instanceScope.FCKIECleanup_Cleanup)) {
    instanceScope.FCKIECleanup_Cleanup();
  }
  instanceScope.FCKeditorAPI_ConfirmCleanup();
  instanceScope.FCKeditorAPI_Cleanup();
  // Remove the editor elements.
  $('#' + instanceName + '___Config').remove();
  $('#' + instanceName + '___Frame').remove();
  $('#' + instanceName).show();
};

Drupal.wysiwyg.editor.instance.fckeditor = {
  init: function(instance) {
    var wysiwygInstance = instance.wysiwygInstance;
    var pluginInfo = wysiwygInstance.pluginInfo;
    var enabledPlugins = pluginInfo.instances.drupal;
    // Track which editor instance is active.
    instance.FCK.Events.AttachEvent('OnFocus', function(editorInstance) {
      Drupal.wysiwyg.activeId = editorInstance.Name;
    });

    // Create a custom data processor to wrap the default one and allow Drupal
    // plugins modify the editor contents.
    var wysiwygDataProcessor = function() {};
    wysiwygDataProcessor.prototype = new instance.FCKDataProcessor();
    // Attach: Convert text into HTML.
    wysiwygDataProcessor.prototype.ConvertToHtml = function(data) {
      // Called from SetData() with stripped comments/scripts, revert those
      // manipulations and attach Drupal plugins.
      var data = instance.FCKConfig.ProtectedSource.Revert(data);
      for (var plugin in enabledPlugins) {
        if (typeof Drupal.wysiwyg.plugins[plugin].attach == 'function') {
          data = Drupal.wysiwyg.plugins[plugin].attach(data, pluginInfo.global.drupal[plugin], instance.FCK.Name);
          data = Drupal.wysiwyg.editor.instance.fckeditor.prepareContent(data);
        }
      }
      // Re-protect the source and use the original data processor to convert it
      // into XHTML.
      data = instance.FCKConfig.ProtectedSource.Protect(data);
      return instance.FCKDataProcessor.prototype.ConvertToHtml.call(this, data);
    };
    // Detach: Convert HTML into text.
    wysiwygDataProcessor.prototype.ConvertToDataFormat = function(rootNode, excludeRoot, ignoreIfEmptyParagraph, format) {
      // Called from GetData(), convert the content's DOM into a XHTML string
      // using the original data processor and detach Drupal plugins.
      var data = instance.FCKDataProcessor.prototype.ConvertToDataFormat.call(this, rootNode, excludeRoot, ignoreIfEmptyParagraph, format);
      for (var plugin in enabledPlugins) {
        if (typeof Drupal.wysiwyg.plugins[plugin].detach == 'function') {
          data = Drupal.wysiwyg.plugins[plugin].detach(data, pluginInfo.global.drupal[plugin], instance.FCK.Name);
        }
      }
      return data;
    };
    instance.FCK.DataProcessor = new wysiwygDataProcessor();
  },

  addPlugin: function(plugin, pluginSettings, instance) {
    if (typeof Drupal.wysiwyg.plugins[plugin] != 'object') {
      return;
    }

    if (pluginSettings.css) {
      instance.FCKConfig.EditorAreaCSS += ',' + pluginSettings.css;
    }

    // @see fckcommands.js, fck_othercommands.js, fckpastewordcommand.js
    instance.FCKCommands.RegisterCommand(plugin, {
      // Invoke the plugin's button.
      Execute: function () {
        if (typeof Drupal.wysiwyg.plugins[plugin].invoke == 'function') {
          var data = { format: 'html', node: instance.FCKSelection.GetParentElement() };
          // @todo This is NOT the same as data.node.
          data.content = data.node.innerHTML;
          Drupal.wysiwyg.plugins[plugin].invoke(data, pluginSettings, instance.FCK.Name);
        }
      },

      // isNode: Return whether the plugin button should be enabled for the
      // current selection.
      // @see FCKUnlinkCommand.prototype.GetState()
      GetState: function () {
        // Always disabled if not in WYSIWYG mode.
        if (instance.FCK.EditMode != FCK_EDITMODE_WYSIWYG) {
          return FCK_TRISTATE_DISABLED;
        }
        var state = instance.FCK.GetNamedCommandState(this.Name);
        // FCKeditor sets the wrong state in WebKit browsers.
        if (!$.support.queryCommandEnabled && state == FCK_TRISTATE_DISABLED) {
          state = FCK_TRISTATE_OFF;
        }
        if (state == FCK_TRISTATE_OFF && instance.FCK.EditMode == FCK_EDITMODE_WYSIWYG) {
          if (typeof Drupal.wysiwyg.plugins[plugin].isNode == 'function') {
            var node = instance.FCKSelection.GetSelectedElement();
            state = Drupal.wysiwyg.plugins[plugin].isNode(node) ? FCK_TRISTATE_ON : FCK_TRISTATE_OFF;
          }
        }
        return state;
      },

      /**
       * Return information about the plugin as a name/value array.
       */
      Name: plugin
    });

    // Register the plugin button.
    // Arguments: commandName, label, tooltip, style, sourceView, contextSensitive, icon.
    instance.FCKToolbarItems.RegisterItem(plugin, new instance.FCKToolbarButton(plugin, pluginSettings.title, pluginSettings.title, null, false, true, pluginSettings.icon));
  },

  openDialog: function(dialog, params) {
    // @todo Implement open dialog.
  },

  closeDialog: function(dialog) {
    // @todo Implement close dialog.
  },

  prepareContent: function(content) {
    // @todo Not needed for FCKeditor?
    return content;
  },

  insert: function(content) {
    var instance = FCKeditorAPI.GetInstance(this.field);
    // @see FCK.InsertHtml(), FCK.InsertElement()
    instance.InsertHtml(content);
  },

  getContent: function () {
    var instance = FCKeditorAPI.GetInstance(this.field);
    return instance.GetData();
  },

  setContent: function (content) {
    var instance = FCKeditorAPI.GetInstance(this.field);
    instance.SetHTML(content);
  },

  isFullscreen: function () {
    var cmd = FCKeditorAPI.GetInstance(this.field).Commands.LoadedCommands.FitWindow;
    return !!(cmd && cmd.IsMaximized);
  }
};

})(jQuery);
