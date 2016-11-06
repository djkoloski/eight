// CONSTANTS
var PROGRAM_WIDTH = 8;
var PROGRAM_HEIGHT = 8;
var DATA_HALFWIDTH = 28;
var RUN_INTERVAL = 100;
var FAST_INTERVAL = 0;

var Puzzle = function(desc, input, output) {
	this.desc = desc;
	this.input = input;
	this.output = output;
};

var PUZZLES = [
	new Puzzle(
		'Copy input to output then halt',
		'123456789ABCDEF',
		'123456789ABCDEF'
	),
	new Puzzle(
		'Add each pair of inputs then halt',
		'12345678765432',
		'37BFD95'
	),
	new Puzzle(
		'Copy the input to the output reversed',
		'123456789ABCDEF',
		'FEDCBA987654321'
	),
	new Puzzle(
		'Add each F-delimited subsequence from input into output',
		'12F1F12345F722F',
		'31FB'
	),
	new Puzzle(
		'Read a number and output the next one that number of times',
		'1F23F7663B',
		'F33777777777777777666666BBB'
	)
];

// ENUMS
var GameState = {
	None: -1,
	Editing: 0,
	Running: 1
};
var Conditional = {
	Input: 0,
	Output: 1
};
var ConditionalCode = {
	0: 'I',
	1: 'O'
};
var ConditionalData = {
	'I': 0,
	'O': 1
};
var Instruction = {
	HLT: 0,
	MVR: 1,
	MVL: 2,
	SWP: 3,
	SEQ: 4,
	ADD: 5,
	SUB: 6,
	JMP: 7
};
var InstructionCode = {
	0: 'HLT',
	1: 'MVR',
	2: 'MVL',
	3: 'SWP',
	4: 'SEQ',
	5: 'ADD',
	6: 'SUB',
	7: 'JMP'
};
var InstructionData = {
	'HLT': 0,
	'MVR': 1,
	'MVL': 2,
	'SWP': 3,
	'SEQ': 4,
	'ADD': 5,
	'SUB': 6,
	'JMP': 7
};
var InstructionHasValue = {
	0: false,
	1: false,
	2: false,
	3: false,
	4: true,
	5: false,
	6: false,
	7: true
};
var NullCode = '';
var NullData = 0x0F;
var ErrorData = -1;

// GLOBALS
var game = null;

// -----------------------------------------------------------------------------
// PROGRAM DISPLAY
// -----------------------------------------------------------------------------
var ProgramDisplay = function(width, height) {
	this.data = new Uint8Array(width * height);
	this.width = width;
	this.height = height;
	this.position = 0;
};
ProgramDisplay.prototype.Set = function(index, cond, inst, val) {
	this.data[index] = (cond << 7) | (inst << 4) | val;
};
ProgramDisplay.prototype.Jump = function(offset) {
	this.position = (this.position + offset) % (this.width * this.height);
	if (this.position < 0)
		this.position += this.width * this.height;
	while (this.data[this.position] == NullData)
		++this.position;
};
ProgramDisplay.prototype.MoveTo = function(position) {
	this.position = position;
};
ProgramDisplay.prototype.RenderEditing = function(element) {
	var content = '';

	for (var x = 0, i = 0; x < this.width; ++x) {
		content += '<div class="column"><textarea id="programcol' + x + '">';
		for (var y = 0; y < this.height; ++y, ++i)
			content += ProgramDisplay.DataToCode(this.data[i]) + (y < this.height - 1 ? '\n' : '');
		content += '</textarea></div>';
	}

	element.innerHTML = content;
};
ProgramDisplay.prototype.RenderRunning = function(element) {
	var content = '';

	for (var x = 0, i = 0; x < this.width; ++x) {
		content += '<div class="column">';
		for (var y = 0; y < this.height; ++y, ++i) {
			var style = '';
			if (i == this.position)
				style = 'current';
			content += '<div class="row ' + style + '">' + ProgramDisplay.DataToCode(this.data[i]) + '</div>';
		}
		content += '</div>';
	}

	element.innerHTML = content;
};
ProgramDisplay.prototype.Initialize = function(code) {
	for (var i = 0; i < this.width * this.height; ++i)
		this.data[i] = NullData;

	var lines = code.split('\n');
	for (var i = 0; i < lines.length; ++i) {
		var data = ProgramDisplay.CodeToData(lines[i]);
		if (data == ErrorData) {
			alert('Invalid code at column ' + Math.floor(i / this.height) + ', row ' + (i % this.height) + ':\n\n' + lines[i]);
			return false;
		}
		this.data[i] = data;
	}

	return true;
};
ProgramDisplay.CodeToData = function(code) {
	code = code.replace(/ +(?= )/g, '').trim();
	if (code == NullCode)
		return NullData;

	var pieces = code.split(' ');
	
	var cond = ConditionalData[(pieces[0] || '').toUpperCase()];
	var inst = InstructionData[(pieces[1] || '').toUpperCase()];
	var val = pieces[2];

	if (cond == null || inst == null)
		return ErrorData;

	if ((val != null) != InstructionHasValue[inst])
		return ErrorData;

	return (cond << 7) | (inst << 4) | (parseInt(val || 0xf, 16) & 0xf);
};
ProgramDisplay.DataToCode = function(data) {
	if (data == NullData)
		return NullCode;

	var cond = (data & 0x80) >> 7;
	var inst = (data & 0x70) >> 4;
	var val = (data & 0x0f);

	return ConditionalCode[cond] + ' '
		+ InstructionCode[inst]
		+ (InstructionHasValue[inst] ? ' ' + val.toString(16).toUpperCase() : '');
};
ProgramDisplay.prototype.GetCond = function(index) {
	return (this.data[index] & 0x80) >> 7;
};
ProgramDisplay.prototype.GetInst = function(index) {
	return (this.data[index] & 0x70) >> 4;
};
ProgramDisplay.prototype.GetVal = function(index) {
	return (this.data[index] & 0x0F);
};
ProgramDisplay.prototype.GetIsNull = function(index) {
	return (this.data[index] == NullData);
};
ProgramDisplay.prototype.GetCurrentCond = function() {
	return this.GetCond(this.position);
};
ProgramDisplay.prototype.GetCurrentInst = function() {
	return this.GetInst(this.position);
};
ProgramDisplay.prototype.GetCurrentVal = function() {
	return this.GetVal(this.position);
};
ProgramDisplay.prototype.IsCurrentNull = function() {
	return this.GetIsNull(this.position);
};
ProgramDisplay.prototype.Advance = function() {
	this.position = (this.position + 1) % (this.width * this.height);
};
ProgramDisplay.prototype.Reset = function() {
	this.position = 0;
};
ProgramDisplay.prototype.ParseCode = function(element) {
	var allLines = [];
	for (var i = 0; i < this.width; ++i) {
		var textarea = element.querySelector('#programcol' + i);
		var lines = textarea.value.split('\n');
		for (var j = 0; j < lines.length; ++j) {
			allLines.push(lines[j]);
		}
		for (var j = lines.length; j < this.height; ++j) {
			allLines.push(NullCode);
		}
	}

	return this.Initialize(allLines.join('\n'));
};

// -----------------------------------------------------------------------------
// DATA DISPLAY
// -----------------------------------------------------------------------------
var DataDisplay = function() {
	this.data = null;
	this.position = 0;
};
DataDisplay.prototype.Initialize = function(dataString) {
	this.data = {};
	for (var i = 0; i < dataString.length; ++i)
		this.data[i] = parseInt(dataString[i], 16);
};
DataDisplay.prototype.RenderEditing = function(element, halfWidth) {
	var content = '';

	for (var i = this.position - halfWidth; i <= this.position + halfWidth; ++i) {
		var data = this.data[i];
		var style = '';
		if (data == null) {
			style += 'undefined';
			data = 0;
		}
		content += '<span class="' + style + '">' + data.toString(16).toUpperCase() + '</span>';
	}

	element.innerHTML = content;
};
DataDisplay.prototype.RenderRunning = function(element, halfWidth) {
	var content = '';

	for (var i = this.position - halfWidth; i <= this.position + halfWidth; ++i) {
		var data = this.data[i];
		var style = '';
		if (i == this.position)
			style += 'current';
		if (data == null) {
			style += ' undefined';
			data = 0;
		}
		content += '<span class="' + style + '">' + data.toString(16).toUpperCase() + '</span>';
	}

	element.innerHTML = content;
};
DataDisplay.prototype.Get = function(index) {
	return this.data[index] || 0;
};
DataDisplay.prototype.Set = function(index, value) {
	this.data[index] = value;
};
DataDisplay.prototype.GetCurrent = function() {
	return this.Get(this.position);
};
DataDisplay.prototype.SetCurrent = function(value) {
	this.Set(this.position, value);
};
DataDisplay.prototype.Move = function(amount) {
	this.position += amount;
};
DataDisplay.prototype.MoveTo = function(position) {
	this.position = position;
};
DataDisplay.prototype.Compare = function(other) {
	for (key in this.data) {
		if (this.Get(key) != other.Get(key))
			return false;
	}
	return true;
};
DataDisplay.prototype.Clear = function() {
	this.data = {};
};
DataDisplay.prototype.Reset = function() {
	this.position = 0;
};
DataDisplay.prototype.ClearAndReset = function() {
	this.Clear();
	this.Reset();
};

// -----------------------------------------------------------------------------
// GAME
// -----------------------------------------------------------------------------
var Game = function() {
	this.state = GameState.None;
	this.conditional = Conditional.Input;
	
	this.input = new DataDisplay();
	this.program = new ProgramDisplay(PROGRAM_WIDTH, PROGRAM_HEIGHT);
	this.output = new DataDisplay();
	this.reference = new DataDisplay();

	this.inputElement = document.getElementById('input');
	this.programElement = document.getElementById('program');
	this.outputElement = document.getElementById('output');
	this.referenceElement = document.getElementById('reference');

	this.stopButton = document.getElementById('stop');
	this.stepButton = document.getElementById('step');
	this.runPauseButton = document.getElementById('runpause');
	this.fastButton = document.getElementById('fast');

	this.currentPuzzle = 0;

	this.update = null;
	this.stopButton.addEventListener(
		'click',
		function() {
			game.Stop();
		}
	);
	this.stepButton.addEventListener(
		'click',
		function() {
			if (game.state == GameState.Editing)
				game.BeginRunning();
			else
				game.Step();
		}
	);
	this.runPauseButton.addEventListener(
		'click',
		function() {
			if (game.state == GameState.Editing) {
				game.BeginRunning();
				if (game.state == GameState.Running)
					game.Run();
			} else if (game.state == GameState.Running) {
				if (game.update == null)
					game.Run();
				else
					game.Pause();
			}
		}
	);
	this.fastButton.addEventListener(
		'click',
		function() {
			if (game.state == GameState.Editing)
				game.BeginRunning();
			if (game.state == GameState.Running)
				game.Fast();
		}
	);
};
Game.prototype.Render = function() {
	switch (this.state) {
		case GameState.Editing:
			this.RenderEditing();
			break;
		case GameState.Running:
			this.RenderRunning();
			break;
		default:
			throw new Error('Invalid state in Render');
	}
};
Game.prototype.RenderEditing = function() {
	this.inputElement.classList.remove('active');
	this.outputElement.classList.remove('active');
	this.referenceElement.classList.remove('active');

	this.input.RenderEditing(this.inputElement, DATA_HALFWIDTH);
	this.program.RenderEditing(this.programElement);
	this.output.RenderEditing(this.outputElement, DATA_HALFWIDTH);
	this.reference.RenderEditing(this.referenceElement, DATA_HALFWIDTH);
};
Game.prototype.RenderRunning = function() {
	if (this.conditional == Conditional.Input) {
		this.inputElement.classList.add('active');
		this.outputElement.classList.remove('active');
		this.referenceElement.classList.remove('active');
	} else {
		this.inputElement.classList.remove('active');
		this.outputElement.classList.add('active');
		this.referenceElement.classList.add('active');
	}

	this.input.RenderRunning(this.inputElement, DATA_HALFWIDTH);
	this.program.RenderRunning(this.programElement);
	this.output.RenderRunning(this.outputElement, DATA_HALFWIDTH);
	this.reference.RenderRunning(this.referenceElement, DATA_HALFWIDTH);
};
Game.prototype.Pause = function() {
	if (this.update != null)
		clearInterval(this.update);
	this.update = null;
	this.runPauseButton.classList.add('paused');
};
Game.prototype.Stop = function() {
	this.Pause();
	this.BeginEditing();
};
Game.prototype.Step = function() {
	var mainTape = null;
	var otherTape = null;
	if (this.conditional == Conditional.Input) {
		mainTape = this.input;
		otherTape = this.output;
	} else {
		mainTape = this.output;
		otherTape = this.input;
	};

	this.SeekNextInstruction();

	var inst = this.program.GetCurrentInst();
	var val = this.program.GetCurrentVal();

	var advance = true;

	switch (inst) {
		case Instruction.HLT:
			this.Halt();
			return;
		case Instruction.MVR:
			mainTape.Move(1);
			break;
		case Instruction.MVL:
			mainTape.Move(-1);
			break;
		case Instruction.SWP:
			this.Swap();
			break;
		case Instruction.SEQ:
			if (mainTape.GetCurrent() == val)
				this.Swap();
			break;
		case Instruction.ADD:
			mainTape.SetCurrent(mainTape.GetCurrent() + otherTape.GetCurrent());
			break;
		case Instruction.SUB:
			mainTape.SetCurrent(mainTape.GetCurrent() - otherTape.GetCurrent());
			break;
		case Instruction.JMP:
			if ((val & 0x08) != 0)
				val = val - 16;
			this.program.Jump(val);
			advance = false;
			break;
		default:
			throw new Error('Invalid instruction \'' + inst + '\'');
			break;
	};

	// Keep reference tape in sync with output tape
	this.reference.MoveTo(this.output.position);

	if (advance) {
		this.program.Advance();
		this.SeekNextInstruction();
	}

	this.Render();
};
Game.prototype.Run = function() {
	this.Pause();
	this.Step();
	this.update = setInterval(
		function() {
			game.Step();
		},
		RUN_INTERVAL
	);
	this.runPauseButton.classList.remove('paused');
};
Game.prototype.Fast = function() {
	this.Pause();
	this.Step();
	this.update = setInterval(
		function() {
			game.Step();
		},
		FAST_INTERVAL
	);
	this.runPauseButton.classList.remove('paused');
};
Game.prototype.Swap = function() {
	if (this.conditional == Conditional.Input)
		this.conditional = Conditional.Output;
	else
		this.conditional = Conditional.Input;
};
Game.prototype.SeekNextInstruction = function() {
	while (this.program.GetCurrentCond() != this.conditional || this.program.IsCurrentNull())
		this.program.Advance();
};
Game.prototype.Halt = function() {
	this.Pause();
	this.Render();

	if (this.output.Compare(this.reference) && this.reference.Compare(this.output)) {
		alert('Passed!');
		++this.currentPuzzle;
		this.StartPuzzle();
	} else
		alert('Failed!');
};
Game.prototype.BeginEditing = function() {
	this.state = GameState.Editing;

	this.input.Reset();
	this.program.Reset();
	this.output.ClearAndReset();
	this.reference.Reset();

	this.Render();
};
Game.prototype.BeginRunning = function() {
	if (!this.program.ParseCode(this.programElement))
		return;

	this.state = GameState.Running;

	this.conditional = Conditional.Input;
	this.input.Initialize(PUZZLES[this.currentPuzzle].input);
	this.program.Reset();
	this.output.ClearAndReset();
	this.reference.Reset();

	this.Render();
};
Game.prototype.StartPuzzle = function() {
	document.getElementById('description').innerHTML = 'PUZZLE: ' + PUZZLES[this.currentPuzzle].desc.toUpperCase();

	this.input.Initialize(PUZZLES[this.currentPuzzle].input);
	this.program.Initialize('');
	this.output.ClearAndReset();
	this.reference.Initialize(PUZZLES[this.currentPuzzle].output);

	game.BeginEditing();
};

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
window.onload = function() {
	game = new Game();

	game.StartPuzzle();
};
