import { canvas } from '/canvas.js';
import { state } from '/history.js';

let activeColor = '#000000',
  activeWidth = '1';
let latestUpdatedJSON = '';
let latestAddedObject = '';
let latestRemovedObject = '';
let latestModifiedObject = '';
let throttleFunction = '';
let throttleTime = 250;
let isRedoing = false;
let timer = false;
let HIGHLIGHTER_SELECTED = false;
let ERASER_SELECTED = false;

// var $ = function (id) {
//   return document.getElementById(id);
// };
// var json =
//   '{"objects":[{"type":"rect","originX":"center","originY":"center","left":300,"top":150,"width":150,"height":150,"fill":"#29477F","overlayFill":null,"stroke":null,"strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeLineJoin":"miter","strokeMiterLimit":10,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":{"color":"rgba(94, 128, 191, 0.5)","blur":5,"offsetX":10,"offsetY":10},"visible":true,"clipTo":null,"rx":0,"ry":0,"x":0,"y":0},{"type":"circle","originX":"center","originY":"center","left":300,"top":400,"width":200,"height":200,"fill":"rgb(166,111,213)","overlayFill":null,"stroke":null,"strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeLineJoin":"miter","strokeMiterLimit":10,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":{"color":"#5b238A","blur":20,"offsetX":-20,"offsetY":-10},"visible":true,"clipTo":null,"radius":100}],"background":""}';

// canvas.loadFromJSON(
//   json,
//   canvas.renderAll.bind(canvas)
//   //   function (o, object) {
//   //     fabric.log(o, object);
//   //   }
// );

fabric.Object.prototype.transparentCorners = false;

let drawingModeEl = $('#drawing-mode'),
  drawingColorEl = $('#drawing-color'),
  drawingLineWidthEl = $('#drawing-line-width'),
  brushSelector = $('.brush-mode-selector'),
  undo = $('#undo'),
  redo = $('#redo'),
  deleteSelection = $('#delete'),
  clearEl = $('#clear-canvas');

clearEl.on('click', function () {
  canvas.clear();
  state.history = [];
});

drawingModeEl.click(function () {
  shiftDrawingMode();
});

deleteSelection.click(deleteSelectedObject);

drawingColorEl.on('change', setDrawingColor);

drawingLineWidthEl.on('change', setBrushWidth);

brushSelector.click(brushSelectorFunction);

undo.click(undoFunction);
redo.click(redoFunction);

function shiftDrawingMode() {
  canvas.isDrawingMode = !canvas.isDrawingMode;
  discardSelection();
}

function setDrawingColor() {
  var brush = canvas.freeDrawingBrush;
  activeColor = this.value;
  if (HIGHLIGHTER_SELECTED) {
    brush.color = activeColor + '59';
    // console.log('highlighter');
  } else {
    brush.color = activeColor;
  }
  // console.log(activeColor);
}

function setBrushWidth() {
  activeWidth = parseInt(this.value, 10) || 1;
  canvas.freeDrawingBrush.width = activeWidth;
  this.previousSibling.innerHTML = this.value;
}

function brushSelectorFunction() {
  if (!canvas.isDrawingMode) canvas.isDrawingMode = true;
  let brush_type = $(this).data('brush');
  let id = $(this).attr('id');
  if (id === 'highlighter') {
    HIGHLIGHTER_SELECTED = true;
    ERASER_SELECTED = false;
  } else if (id === 'eraser') {
    HIGHLIGHTER_SELECTED = false;
    ERASER_SELECTED = true;
  } else {
    HIGHLIGHTER_SELECTED = false;
    ERASER_SELECTED = false;
  }
  changeBrush(brush_type);
  setBrushProperties();
}

function setBrushProperties() {
  var brush = canvas.freeDrawingBrush;
  if (HIGHLIGHTER_SELECTED) {
    brush.color = activeColor + '59';
    // console.log('highlighter');
  } else {
    brush.color = activeColor;
  }
  brush.width = activeWidth;
}

function changeBrush(brushType) {
  canvas.freeDrawingBrush = new fabric[`${brushType}Brush`](canvas);
}

function discardSelection() {
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

canvas.on({
  'after:render': sendFullCanvas,
  'object:added': objectAddedFunction,
  'object:removed': removedObject,
  'object:modified': modifiedObject
});

onMessageReceived = function ({ message }) {
  // console.log('message received');
  let newUpdates = JSON.parse(message);
  // console.log(newUpdates);

  if (newUpdates.event === 'added') {
    addNewObject(newUpdates.target);
  } else if (newUpdates.event === 'removed') {
    removeObject(newUpdates.target);
  } else if (newUpdates.event === 'modified') {
    // console.log(newUpdates.event);

    modifyObject(newUpdates.target);
  } else {
    // console.log('running else');
    if (latestUpdatedJSON !== newUpdates) {
      // console.log('data changed while received');
      renderFullCanvas(newUpdates);
    }
  }
  latestUpdatedJSON = convertToJSON();
};

function sendFullCanvas() {
  if (ERASER_SELECTED) {
    let message = convertToJSON();
    // console.log('sending canvas:', message);
    // debugger;
    if (message !== latestUpdatedJSON) {
      // console.log('data changed while sending message');
      sendMessage(message);
    }
  }
}

function sendNewObject(obj) {
  let target = obj.target;
  let _obj = {};
  // new fabric.Path.fromObject(target, function (foo) {
  _obj.target = target;
  // });
  target = JSON.stringify(target);
  _obj.event = 'added';
  _obj = JSON.stringify(_obj);
  if (latestAddedObject !== target) {
    sendMessage(_obj);
    latestAddedObject = target;
  }
}

function removedObject(obj) {
  let target = obj.target;
  let _obj = {};
  // new fabric.Path.fromObject(target, function (foo) {
  _obj.target = target;
  // });
  target = JSON.stringify(target);
  _obj.event = 'removed';
  _obj = JSON.stringify(_obj);
  if (latestRemovedObject !== target) {
    sendMessage(_obj);
    latestRemovedObject = target;
  }
}

function modifiedObject(obj) {
  let target = JSON.stringify(obj.target);
  let newObject = { ...obj };
  newObject.event = 'modified';
  newObject = JSON.stringify(newObject);
  // if (latestAddedObject !== newObject) {
  sendMessage(newObject);
  latestAddedObject = target;
  latestRemovedObject = target;
  // }
}

function addNewObject(obj) {
  let _obj = {};
  new fabric.Path.fromObject(obj, function (foo) {
    _obj = foo.toObject([]);
    if (latestAddedObject !== JSON.stringify(_obj)) {
      canvas.add(foo);
      latestAddedObject = JSON.stringify(_obj);
    }
  });

  // latestUpdatedJSON = convertToJSON();
}

function removeObject(obj) {
  console.log('removing object');
  let _obj = {};
  new fabric.Path.fromObject(obj, function (foo) {
    _obj = foo.toObject([]);
    canvas.remove(foo);
    console.log('removed');
  });
  if (latestRemovedObject !== JSON.stringify(_obj)) {
    latestRemovedObject = JSON.stringify(_obj);
  }
  // latestUpdatedJSON = convertToJSON();
}

function modifyObject(obj) {
  new fabric.Path.fromObject(obj, function (foo) {
    canvas.remove(foo);
  });
  latestRemovedObject = JSON.stringify(obj);
  new fabric.Path.fromObject(obj, function (foo) {
    canvas.add(foo);
  });
  latestAddedObject = JSON.stringify(obj);
  // latestUpdatedJSON = convertToJSON();
}

function renderFullCanvas(newUpdates) {
  canvas.loadFromJSON(newUpdates, canvas.renderAll.bind(canvas));
}

function objectAddedFunction(obj) {
  setHistory();
  sendNewObject(obj);
}

function sendMessage(message) {
  meeting?.pubSub?.publish('CANVAS', message, { persist: true });
}

function throttle() {
  let interval = setInterval(() => {
    if (typeof throttleFunction === 'function') {
      throttleFunction();
      timer = true;
    } else {
      clearInterval(interval);
      timer = false;
    }
    // console.log('throttle time');
  }, throttleTime);
}

function setHistory() {
  if (!isRedoing) {
    state.history = [];
  }
  isRedoing = false;
}

function undoFunction() {
  if (canvas._objects.length > 0) {
    state.history.push(canvas._objects.pop());
    canvas.renderAll();
  }
}
function redoFunction() {
  if (state.history.length > 0) {
    isRedoing = true;
    canvas.add(state.history.pop());
  }
}

function deleteSelectedObject() {
  let selectedObject = canvas.getActiveObject();
  if (selectedObject._objects == undefined) {
    canvas.remove(selectedObject);
  } else {
    selectedObject?._objects?.forEach(element => {
      canvas.remove(element);
      discardSelection();
    });
  }
}
