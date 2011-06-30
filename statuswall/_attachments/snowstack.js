/*
	Snow Stack 3D CSS Photo Viewer

	Copyright (C) 2009 Charles Ying. All Rights Reserved.
	This source code is available under Apache License 2.0.

	Performance Notes (courtesy of Apple):

		on leopard, animating transforms with a transform list > 1
		function, animation falls back to software shadows (and
		animated shadows) plus border animations can cause additional
		redraws offsetWidth / offsetHeight should be avoided.
*/

// (function () { // Module pattern

var global = this;

var CWIDTH;
var CHEIGHT;
var CGAP = 10;
var CXSPACING;
var CYSPACING;

var snowstack_options = {
	rows: 1,
};

var vfx = {
	elem: function (name, attrs, child) {
		var e = document.createElement(name);
		if (attrs)
		{
			for (var key in attrs)
			{
				if (attrs.hasOwnProperty(key))
				{
					e.setAttribute(key, attrs[key]);
				}
			}
		}

		if (child)
		{
			e.appendChild(child);
		}
		return e;
	},
	byid: function (id)
	{
		return document.getElementById(id);
	},
	loadhandler: function (elem, callback)
	{
		elem.addEventListener("load", callback, false);
	},
	translate3d: function (x, y, z)
	{
		return "translate3d(" + x + "px, " + y + "px, " + z + "px)";
	}
};

var currentCellIndex = -1;
var cells = [];

var dolly;
var camera;

var cellstack;

var magnifyMode;

var zoomTimer = null;
var currentTimer = null;

function cameraTransformForCell(n)
{
	var x = Math.floor(n / snowstack_options.rows);
	var y = n - x * snowstack_options.rows;
	var cx = (x + 0.5) * CXSPACING;
	var cy = (y + 0.5) * CYSPACING;

	if (magnifyMode)
	{
		return vfx.translate3d(-cx, -cy, 180);
	}
	else
	{
		return vfx.translate3d(-cx, -cy, 0);
	}
}

function layoutElement(elem, iwidth, iheight)
{
	var ratio = Math.min(CHEIGHT / iheight, CWIDTH / iwidth);

	iwidth *= ratio;
	iheight *= ratio;

	elem.style.width = Math.round(iwidth) + "px";
	elem.style.height = Math.round(iheight) + "px";

	elem.style.left = Math.round((CWIDTH - iwidth) / 2) + "px";
	elem.style.top = Math.round((CHEIGHT - iheight) / 2) + "px";
}

//////////////////////

function setcellclass(c, name)
{
	c.div.className = name;
}

function snowstack_update(newIndex, newmagnifymode)
{
	if (currentCellIndex == newIndex &&
        magnifyMode == newmagnifymode)
	{
		return;
	}

	if (currentCellIndex != -1)
	{
		var oldCell = cells[currentCellIndex];
		setcellclass(oldCell, "cell");
	}

	if (cells.length === 0)
	{
		return;
	}

	newIndex = Math.min(Math.max(newIndex, 0), cells.length - 1);
	currentCellIndex = newIndex;

	var cell = cells[newIndex];
	magnifyMode = newmagnifymode;

	if (magnifyMode)
	{
		cell.div.className = "cell magnify";
	}
	else
	{
		setcellclass(cell, "cell selected");
	}

	dolly.style.webkitTransform = cameraTransformForCell(newIndex);

	var currentMatrix = new WebKitCSSMatrix(document.defaultView.getComputedStyle(dolly, null).webkitTransform);
	var targetMatrix = new WebKitCSSMatrix(dolly.style.webkitTransform);
	var dx = currentMatrix.m41 - targetMatrix.m41;
	var angle = Math.min(Math.max(dx / (CXSPACING * 3), -1), 1) * 45;

	camera.style.webkitTransform = "rotateY(" + angle + "deg)";
	camera.style.webkitTransitionDuration = "330ms";

	if (currentTimer)
	{
		clearTimeout(currentTimer);
	}

	currentTimer = setTimeout(function() {
		camera.style.webkitTransform = "rotateY(0)";
		camera.style.webkitTransitionDuration = "5s";
	}, 330);
}

function snowstack_addimage(info)
{
	var cell = {};
	var n = cells.length;

	cells.push(cell);

	var x = Math.floor(n / snowstack_options.rows);
	var y = n - x * snowstack_options.rows;

	cell.info = info;

	function make_celldiv()
	{
		var div = vfx.elem("div", {
            "class": "cell",
            "style": 'width: ' + CWIDTH + 'px; height: ' + CHEIGHT + 'px' });
		div.style.webkitTransform =
          vfx.translate3d(x * CXSPACING, y * CYSPACING, 0);
		return div;
	}

	cell.div = make_celldiv();

	cell.divbody = vfx.elem("div", { "class": "media" });

    layoutElement(cell.divbody, 600, 200); // el, width, height

    cell.divbody.innerHTML = info;

    cell.div.style.opacity = 1.0;

    cell.div.appendChild(vfx.elem("div", { "class": "mover view" },
                                  cell.divbody));

	cellstack.appendChild(cell.div);
}

function snowstack_sort(sortkey)
{
	var sortfunc;
	if (sortkey == 'date')
	{
		sortfunc = function(a, b)
		{
			var adate = new Date('1 ' + a.info.date);
			var bdate = new Date('1 ' + b.info.date);
			return bdate - adate;
		};
	}
	else
	{
		sortfunc = function(a, b)
		{
			var aval = a.info[sortkey];
			var bval = b.info[sortkey];
			return aval > bval ? 1 : aval < bval ? -1 : 0;
		};
	}

	cells.sort(sortfunc);

	for (var i = 0; i < cells.length; ++i)
	{
		// down then across
		var x = Math.floor(i / snowstack_options.rows);
		var y = i - x * snowstack_options.rows;
		cells[i].div.style.webkitTransform =
          vfx.translate3d(x * CXSPACING, y * CYSPACING, 0);
	}
}

global.snowstack_init = function(imagefun, options)
{
    currentCellIndex = -1;
    cells = [];
    magnifyMode = false;

	var loading = true;

	camera = vfx.byid("camera");

	cellstack = vfx.elem("div", { "class": "view" });
	dolly = vfx.elem("div", { "class": "dolly view" });
	dolly.appendChild(cellstack);

	while (camera.hasChildNodes())
	{
		camera.removeChild(camera.firstChild);
	}

	camera.appendChild(dolly);

	if (options)
	{
		for (var key in options)
		{
			if (options.hasOwnProperty(key))
			{
				snowstack_options[key] = options[key];
			}
		}
	}

	if (typeof(imagefun) !== "function")
	{
		var images_array = imagefun;
		imagefun = function(callback) {
			callback(images_array);
			images_array = [];
		};
	}

	CHEIGHT = Math.round(window.innerHeight / (snowstack_options.rows + 2));
	CWIDTH = Math.round(CHEIGHT * 300 / 180);
	CXSPACING = CWIDTH + CGAP;
	CYSPACING = CHEIGHT + CGAP;

	imagefun(function (images) {
		images.forEach(snowstack_addimage);
		snowstack_update(Math.floor(snowstack_options.rows / 2), false);
		loading = false;
	});

	var keys = { left: false, right: false, up: false, down: false };

	var keymap = { 37: "left", 38: "up", 39: "right", 40: "down" };

	var keytimer = null;
	var keydelay = 330;

	function updatekeys()
	{
		var newCellIndex = currentCellIndex;
		if (keys.left)
		{
			/* Left Arrow */
			if (newCellIndex >= snowstack_options.rows)
			{
				newCellIndex -= snowstack_options.rows;
			}
		}
		if (keys.right)
		{
			/* Right Arrow */
			if ((newCellIndex + snowstack_options.rows) < cells.length)
			{
				newCellIndex += snowstack_options.rows;
			}
		}
		if (keys.up)
		{
			/* Up Arrow */
			newCellIndex -= 1;
		}
		if (keys.down)
		{
			/* Down Arrow */
			newCellIndex += 1;
		}

		snowstack_update(newCellIndex, magnifyMode);
	}

	function repeattimer()
	{
		updatekeys();
		keytimer = setTimeout(repeattimer, keydelay);
		keydelay = 60;
	}

	function keycheck()
	{
		if (keys.left || keys.right || keys.up || keys.down)
		{
			if (keytimer === null)
			{
				keydelay = 330;
				repeattimer();
			}
		}
		else
		{
			clearTimeout(keytimer);
			keytimer = null;
		}
	}

	/* Limited keyboard support for now */
	window.addEventListener('keydown', function (e)
	{
        if (e.target.tagName == "INPUT" ||
            e.target.tagName == "TEXTAREA")
            return false;

		if (e.keyCode == 32)
		{
			/* Magnify toggle with spacebar */
			snowstack_update(currentCellIndex, !magnifyMode);
		}
		else
		{
			keys[keymap[e.keyCode]] = true;
		}

		keycheck();
	});

	window.addEventListener('keyup', function (e)
	{
        if (e.target.tagName == "INPUT" ||
            e.target.tagName == "TEXTAREA")
            return false;

		keys[keymap[e.keyCode]] = false;
		keycheck();
	});

	var startX = 0;
	var lastX = 0;

	var target = document.getElementById("camera");

	target.addEventListener('touchstart', function (e)
	{
		startX = event.touches[0].pageX;
		lastX = startX;
		e.preventDefault();
		return false;
	}, false);

	target.addEventListener('touchmove', function (e)
	{
		lastX = event.touches[0].pageX;
		var dx = lastX - startX;
		keys.left = (dx > 20);
		keys.right = (dx < 20);
		updatekeys();
		startX = lastX;
		e.preventDefault();
		return false;
	}, true);

	target.addEventListener('touchend', function (e)
	{
		keys.left = false;
		keys.right = false;
		e.preventDefault();
		return false;
	}, true);

};

//})(); // end module pattern
