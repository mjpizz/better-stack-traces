# Better Stack Traces

Ever find yourself digging line-by-line through a Javascript stack trace
to find the "real" error?

    Error: ENOENT, no such file or directory '/bad/file/path'
        at Object.openSync (fs.js:230:18)
        at Object.readFileSync (fs.js:120:15)
        at readMyFile (/path/to/some/code/example.js:10:6)
        at doStuff (/path/to/some/code/example.js:5:10)
        at Object.<anonymous> (/path/to/some/code/example.js:13:1)
        at Module._compile (module.js:441:26)
        at Object..js (module.js:459:10)
        at Module.load (module.js:348:31)

With `better-stack-traces`, you get inline code snippets instead:

    Error: ENOENT, no such file or directory '/bad/file/path'
        at Object.openSync (fs.js:230:18)
        at Object.readFileSync (fs.js:120:15)
        at readMyFile (/path/to/some/code/example.js:10:6)
        ──────────────────────────────────────────────────
         8 » 
         9 » function readMyFile(filePath) {
        10 »   fs.readFileSync(filePath);
        •••••••••••
        11 » }
        12 » 
        13 » doStuff(readMyFile)
        
        at doStuff (/path/to/some/code/example.js:5:10)
        ───────────────────────────────────────────────
        3 » 
        4 » function doStuff(readCallback) {
        5 »   return readCallback("/bad/file/path");
        ••••••••••••••
        6 » }
        7 » 
        8 » 
        
        at Object.<anonymous> (/path/to/some/code/example.js:13:1)
        ──────────────────────────────────────────────────────────
        11 » }
        12 » 
        13 » doStuff(readMyFile)
        ••••••
        
        at Module._compile (module.js:441:26)
        at Object..js (module.js:459:10)
        at Module.load (module.js:348:31)

# Usage

1. Install the module using `npm install better-stack-traces`
2. At the top of your code, `require("better-stack-traces")`
3. Enjoy easier-to-read stack traces

## Using better-stack-traces with CoffeeScript

If you develop with [CoffeeScript](http://coffeescript.org),
`better-stack-traces` will automatically compile `.coffee` files when
rendering the trace.  Maybe someday we will have
[proper](https://github.com/michaelficarra/CoffeeScriptRedux)
[line number mapping](https://github.com/jashkenas/coffee-script/issues/558),
but until then better stack traces might help your sanity :)

## Using better-stack-traces with Mocha tests

If you use [Mocha](http://visionmedia.github.com/mocha/) for testing, you can
get better traces using:

    mocha --require better-stack-traces

## Customizing the output

Stack traces not quite better enough?  There are a few options to tweak the
output:

```javascript
require("better-stack-traces").install({
  before: 2, // number of lines to show above the error
  after: 3, // number of lines to show below the error
  maxColumns: 80, // maximum number of columns to output in code snippets
  collapseLibraries: true, // omit code snippets from node_modules
})
```

If you want to get really fancy, take a look at the library itself.  You can
subclass `BetterStackTrace` and install your customized subclass instead.

# Related resources

If you find `better-stack-traces` useful, you might be interested in these:

* [V8 Stack Trace API](http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi)
* [Tips for V8 stack formatting](http://www.devthought.com/2011/12/22/a-string-is-not-an-error/)
* [Long stack traces](https://github.com/tlrobinson/long-stack-traces) (for event handlers)
