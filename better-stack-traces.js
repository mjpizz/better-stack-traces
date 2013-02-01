;(function () {

var LINES_BEFORE = 2;
var LINES_AFTER = 3;
var MAX_COLUMNS = 80;
var DEFAULT_INDENT = 4;
var GUTTER_CONTENT = " » ";
var DOT_CHAR = "•";
var ELLIPSIS_CHAR = "…";
var EMDASH_CHAR = "─";
var ERR_FILE_NOT_EXIST = "ENOENT";
var NOOP = function() {};

// Helper for generating a repeated string.
function repeatString(repeat, length) {
  return new Array(length).join(repeat) + repeat;
}

// Helper for getting a default value only when the given value is undefined.
function fallback(value, fallbackValue) {
  return typeof value === "undefined" ? fallbackValue : value;
}

/*
/path/to/your/code.js
─────────────────────
189 » 
190 » function bar(x) {
191 »   throw new Error("x: " + x)
•••••••••••••••
192 » }
193 » 
194 » foo(bar)
*/
function BetterStackTrace(error, frames, opt) {
  this.error = error;
  this.frames = frames;

  // Initialize caches.
  this._outCache = null;
  this._fileCache = {};

  // Parse flags.
  opt = opt || {};
  this._collapseLibraries = fallback(opt.collapseLibraries, true);
  this._linesBefore = fallback(opt.before, LINES_BEFORE);
  this._linesAfter = fallback(opt.after, LINES_AFTER);
  this._maxColumns = opt.maxColumns || MAX_COLUMNS;
  this._outputPrefix = repeatString(" ", fallback(opt.indent, DEFAULT_INDENT));
  this._gutterContent = opt.gutter || GUTTER_CONTENT;

  // Get external dependencies.
  var req = opt.require || (typeof require === "undefined" ? NOOP : require);
  var win = opt.window || (typeof window === "undefined" ? {} : window);
  this._fs = opt.fs || req("fs") || win.fs;
  this._coffee = opt.coffee || req("coffee-script") || win.CoffeeScript;
}

BetterStackTrace.prototype = {

  // Final traces are output as strings.
  toString: function toString() {
    this._outCache = this._outCache || this._format(this.error, this.frames);
    return this._outCache;
  },

  _readCode: function _readCode(fileName) {
    var code = this._fileCache[fileName];
    if (!code) {
      code = this._fs.readFileSync(fileName).toString();
      if (/\.coffee$/.test(fileName)) {
        code = this._compileCoffeScript(code);
      }
      this._fileCache[fileName] = code;
    }
    return code;
  },

  _compileCoffeScript: function _compileCoffeScript(code) {
    if (this._coffee) {
      return this._coffee.compile(code);
    } else {
      return "CoffeeScript compiler unavailable";
    }
  },

  _formatCodeLine: function _formatCodeLine(lineNumber, line, maxLineNumber) {
    var pad = maxLineNumber.toString().length - lineNumber.toString().length;
    var padding = "";
    while (pad-- > 0) {
      padding += " ";
    }
    if (line.length > this._maxColumns) {
      line = line.slice(0, this._maxColumns - 1) + ELLIPSIS_CHAR;
    }
    return padding + lineNumber + this._gutterContent + line;
  },

  _formatCodeArrow: function _formatCodeArrow(lineNumber, columnNumber, maxLineNumber) {
    var length = (this._gutterContent + maxLineNumber).length + columnNumber;
    return repeatString(DOT_CHAR, length);
  },

  _formatContext: function _formatContext(fileName, lineNumber, columnNumber) {

    // Attempt to read the file, compiling to CoffeeScript if needed.
    var code = this._readCode(fileName);

    // Figure out the lines of context before and after.
    var lines = code.split("\n");
    var preLines = lines.slice(lineNumber - this._linesBefore - 1, lineNumber);
    var postLines = lines.slice(lineNumber, lineNumber + this._linesAfter);

    // Collect formatted versions of all the lines. Render
    var formattedLines = [];
    var maxLineNumber = lineNumber + this._linesAfter;
    var currentLineNumber = lineNumber - this._linesBefore;
    function renderLines(lines) {
      while (lines.length) {
        formattedLines.push(this._formatCodeLine(
          currentLineNumber++,
          lines.shift(),
          maxLineNumber
        ));
      }
    }
    renderLines.call(this, preLines);
    formattedLines.push(this._formatCodeArrow(
      currentLineNumber - 1,
      columnNumber,
      maxLineNumber
    ));
    renderLines.call(this, postLines);

    return this._outputPrefix + formattedLines.join("\n" + this._outputPrefix);
  },

  // Based on V8 FormatStackTrace.
  // http://code.google.com/p/v8/source/browse/trunk/src/messages.js
  _format: function _format(error, frames) {
    var lines = [];
    try {
      lines.push(error.toString());
    } catch (e) {
      try {
        lines.push("<error: " + e + ">");
      } catch (ee) {
        lines.push("<error>");
      }
    }
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      var line;
      try {
        line = this._formatFrame(frame);
      } catch (e) {
        try {
          line = "<error: " + e + ">";
        } catch (ee) {
          // Any code that reaches this point is seriously nasty!
          line = "<error>";
        }
      }
      lines.push(line);
    }
    return lines.join("\n");
  },

  // Based on V8 FormatSourcePosition.
  // http://code.google.com/p/v8/source/browse/trunk/src/messages.js
  _formatFrame: function _formatFrame(frame) {
    var fileLocation = "";
    var context = null;
    if (frame.isNative()) {
      fileLocation = "native";
    } else if (frame.isEval()) {
      fileLocation = "eval at " + frame.getEvalOrigin();
    } else {
      var fileName = frame.getFileName();
      if (fileName) {
        fileLocation += fileName;
        var lineNumber = frame.getLineNumber();
        if (lineNumber != null) {
          fileLocation += ":" + lineNumber;
          var columnNumber = frame.getColumnNumber();
          if (columnNumber) {
            fileLocation += ":" + columnNumber;
          }
          try {
            if (this._collapseLibraries && /node_modules/.test(fileName)) {
              context = null;
            } else {
              context = this._formatContext(fileName, lineNumber, columnNumber);
            }
          } catch(err) {
            if (err.code === ERR_FILE_NOT_EXIST) {
              context = null;
            } else {
              context = err;
            }
          }
        }
      }
    }
    if (!fileLocation) {
      fileLocation = "unknown source";
    }
    var line = "";
    var functionName = frame.getFunction().name;
    var methodName = frame.getMethodName();
    var addPrefix = true;
    var isConstructor = frame.isConstructor();
    var isMethodCall = !(frame.isToplevel() || isConstructor);
    if (isMethodCall) {
      line += frame.getTypeName() + ".";
      if (functionName) {
        line += functionName;
        if (methodName && (methodName != functionName)) {
          line += " [as " + methodName + "]";
        }
      } else {
        line += methodName || "<anonymous>";
      }
    } else if (isConstructor) {
      line += "new " + (functionName || "<anonymous>");
    } else if (functionName) {
      line += functionName;
    } else {
      line += fileLocation;
      addPrefix = false;
    }
    if (addPrefix) {
      line += " (" + fileLocation + ")";
    }
    line = "at " + line;
    if (context) {
      var underline = this._outputPrefix + line.replace(/./g, EMDASH_CHAR);
      var betterLine = [line, underline, context].join("\n");
      return this._outputPrefix + betterLine + "\n";
    } else {
      return this._outputPrefix + line;
    }
  }

};

// Helpers for installing and uninstalling stack trace handlers.
var installations = [];

function install(callback) {
  if (typeof callback !== "function") {
    var options = callback;
    callback = function(error, frames) {
      return new BetterStackTrace(error, frames, options).toString();
    };
  }
  if (Error.prepareStackTrace) {
    installations.push(Error.prepareStackTrace)
  }
  Error.prepareStackTrace = callback;
}

function uninstall() {
  if (Error.prepareStackTrace) {
    delete Error.prepareStackTrace;
  }
  if (installations.length) {
    Error.prepareStackTrace = installations.pop();
  }
}

// Export for browser and node.
var exp = typeof exports === "undefined" ? (this.BetterStackTraces = {}) : exports;
exp.install = install;
exp.uninstall = uninstall;
exp.BetterStackTrace = BetterStackTrace;

// Install automatically.
install();

}).call(this);