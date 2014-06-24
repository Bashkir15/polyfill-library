var express   = require('express');
	app       = express(),
	polyfills = require('./index'),
	useragent = require('useragent'),
	uglify    = require('uglify-js'),
	AliasResolver = require('./aliases');

// Load additional useragent features: primarily to use: agent.satisfies to
// test a browser version against a semver string
require('useragent/features');

var aliasResolver = new AliasResolver([
		function(polyfill) {

			var aliases = polyfills.aliases[polyfill.name];

			// If aliases exist, expand them adding aliasOf information to
			// each and tranferring the flags from the alias
			if (aliases) {
				return aliases.map(function(alias) {
					return {
						name: alias,
						flags: polyfill.flags,
						aliasOf: polyfill.aliasOf
					};
				});
			}

			return [polyfill];
		}
	]);

app.get(/^\/polyfill(\.\w+)(\.\w+)?/, function(req, res) {
	var ua = useragent.lookup(req.header('user-agent')),
		requestedPolyfills = parseRequestedPolyfills(req),
		firstParameter = req.params[0].toLowerCase(),
		minified =  firstParameter === '.min',
		extension = minified ? req.params[1].toLowerCase() : firstParameter;


	// Holds the strings that will be built into the explainer comment that is
	// placed before the polyfill code.
	var explainerComment = [
		req.originalUrl,
		'Detected ' + ua.toAgent()
	];

	// Holds the source code for each polyfill
	var polyFills = [];

	if (extension === '.js') {
		res.set('Content-Type', 'application/javascript');
	} else {
		res.set('Conent-Type', 'text/css');
	}

	requestedPolyfills.defaultPolyfills.forEach(function(polyfillInfo) {
		var polyfill = polyfills.sources[polyfillInfo.name];
		if (!polyfill) {
			explainerComment.push(polyfillInfo.name + ' does not match any polyfills');
			return;
		}

		explainerComment.push(polyfillInfo.name + ' - ' + polyfillInfo.aliasOf + ' (LICENSE TODO)');
		polyFills.push(polyfill.file);
	});


	var builtExplainerComment = '/* ' + explainerComment.join('\n * ') + '\n */\n';
	var builtPolyfillString = polyFills.join('\n');

	if (minified) {
		builtPolyfillString = uglify.minify(builtPolyfillString, {fromString: true}).code;
	}

	res.send(builtExplainerComment + builtPolyfillString);
});

app.listen(3000);

function parseRequestedPolyfills(req) {
	var maybeQuery       = req.query.maybe   ? req.query.maybe.split(',')   : [],
		defaultQuery     = req.query.default ? req.query.default.split(',') : [],
		maybePolyfills   = maybeQuery.map(parsePolyfillInfo),
		defaultPolyfills = defaultQuery.map(parsePolyfillInfo);

	return {
		maybePolyfills: aliasResolver.resolve(maybePolyfills),
		defaultPolyfills: aliasResolver.resolve(defaultPolyfills)
	};
}

function parsePolyfillInfo(name) {
	var nameAndFlags = name.split('|');
	return {
		flags: nameAndFlags.slice(1),
		name: nameAndFlags[0],
		aliasOf: nameAndFlags[0]
	};
}
