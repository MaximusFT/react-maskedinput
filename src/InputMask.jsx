/**
 * Component MaskedInput
 * https://github.com/MaximusFT/react-maskedinput
 *
 * @author MaximusFT <maximusft@gmail.com>
 */

function extend(dest, src) {
    if (src) {
        const props = Object.keys(src);
        for (let i = 0, l = props.length; i < l; i++) {
            // eslint-disable-next-line
            dest[props[i]] = src[props[i]];
        }
    }
    return dest;
}

function copy(obj) {
    return extend({}, obj);
}

const ESCAPE_CHAR = '\\';

const DIGIT_RE = /^\d$/;
const LETTER_RE = /^[A-Za-z]$/;
const ALPHANNUMERIC_RE = /^[\dA-Za-z]$/;

const DEFAULT_PLACEHOLDER_CHAR = '_';
const DEFAULT_FORMAT_CHARACTERS = {
    '*': {
        validate(char) { return ALPHANNUMERIC_RE.test(char); },
    },
    1: {
        validate(char) { return DIGIT_RE.test(char); },
    },
    a: {
        validate(char) { return LETTER_RE.test(char); },
    },
    A: {
        validate(char) { return LETTER_RE.test(char); },
        transform(char) { return char.toUpperCase(); },
    },
    '#': {
        validate(char) { return ALPHANNUMERIC_RE.test(char); },
        transform(char) { return char.toUpperCase(); },
    },
};

/**
 * Merge an object defining format characters into the defaults.
 * Passing null/undefined for en existing format character removes it.
 * Passing a definition for an existing format character overrides it.
 * @param {?Object} formatCharacters.
 */
function mergeFormatCharacters(formatCharacters) {
    const merged = copy(DEFAULT_FORMAT_CHARACTERS);
    if (formatCharacters) {
        const chars = Object.keys(formatCharacters);
        for (let i = 0, l = chars.length; i < l; i++) {
            const char = chars[i];
            if (formatCharacters[char] == null) {
                delete merged[char];
            } else {
                merged[char] = formatCharacters[char];
            }
        }
    }
    return merged;
}

/**
 * @param {string} source
 * @patam {?Object} formatCharacters
 */
class Pattern {
    constructor(source, formatCharacters, placeholderChar, isRevealingMask) {
        if (!(this instanceof Pattern)) {
            return new Pattern(source, formatCharacters, placeholderChar);
        }
        /** Placeholder character */
        this.placeholderChar = placeholderChar || DEFAULT_PLACEHOLDER_CHAR;
        /** Format character definitions. */
        this.formatCharacters = formatCharacters || DEFAULT_FORMAT_CHARACTERS;
        /** Pattern definition string with escape characters. */
        this.source = source;
        /** Pattern characters after escape characters have been processed. */
        this.pattern = [];
        /** Length of the pattern after escape characters have been processed. */
        this.length = 0;
        /** Index of the first editable character. */
        this.firstEditableIndex = null;
        /** Index of the last editable character. */
        this.lastEditableIndex = null;
        /** Lookup for indices of editable characters in the pattern. */
        this.editableIndices = {};
        /** If true, only the pattern before the last valid value character shows. */
        this.isRevealingMask = isRevealingMask || false;
        this.parse();
    }
    parse() {
        const sourceChars = this.source.split('');
        let patternIndex = 0;
        const pattern = [];
        for (let i = 0, l = sourceChars.length; i < l; i++) {
            let char = sourceChars[i];
            if (char === ESCAPE_CHAR) {
                if (i === l - 1) {
                    throw new Error(`InputMask: pattern ends with a raw ${ESCAPE_CHAR}`);
                }
                char = sourceChars[++i]; // eslint-disable-line no-plusplus
            } else if (char in this.formatCharacters) {
                if (this.firstEditableIndex === null) {
                    this.firstEditableIndex = patternIndex;
                }
                this.lastEditableIndex = patternIndex;
                this.editableIndices[patternIndex] = true;
            }
            pattern.push(char);
            patternIndex++; // eslint-disable-line no-plusplus
        }
        if (this.firstEditableIndex === null) {
            throw new Error(`InputMask: pattern "${this.source}" does not contain any editable characters.`);
        }
        this.pattern = pattern;
        this.length = pattern.length;
    }
    /**
     * @param {Array<string>} value
     * @return {Array<string>}
     */
    formatValue(value) {
        const valueBuffer = new Array(this.length);
        let valueIndex = 0;
        for (let i = 0, l = this.length; i < l; i++) {
            if (this.isEditableIndex(i)) {
                if (this.isRevealingMask &&
                    value.length <= valueIndex &&
                    !this.isValidAtIndex(value[valueIndex], i)) {
                    break;
                }
                valueBuffer[i] = (
                    value.length > valueIndex &&
                    this.isValidAtIndex(value[valueIndex], i
                )
                    ? this.transform(value[valueIndex], i)
                    : this.placeholderChar);
                valueIndex += 1;
            } else {
                valueBuffer[i] = this.pattern[i];
                // Also allow the value to contain static values from the pattern by
                // advancing its index.
                if (value.length > valueIndex && value[valueIndex] === this.pattern[i]) {
                    valueIndex += 1;
                }
            }
        }
        return valueBuffer;
    }
    /**
     * @param {number} index
     * @return {boolean}
     */
    isEditableIndex(index) {
        return !!this.editableIndices[index];
    }
    /**
     * @param {string} char
     * @param {number} index
     * @return {boolean}
     */
    isValidAtIndex(char, index) {
        return this.formatCharacters[this.pattern[index]].validate(char);
    }
    transform(char, index) {
        const format = this.formatCharacters[this.pattern[index]];
        return typeof format.transform === 'function' ? format.transform(char) : char;
    }
}

class InputMask {
    constructor(options) {
        if (!(this instanceof InputMask)) {
            return new InputMask(options);
        }
        // eslint-disable-next-line
        options = extend({
            formatCharacters: null,
            pattern: null,
            isRevealingMask: false,
            placeholderChar: DEFAULT_PLACEHOLDER_CHAR,
            selection: { start: 0, end: 0 },
            value: '',
        }, options);
        if (options.pattern == null) {
            throw new Error('InputMask: you must provide a pattern.');
        }
        if (typeof options.placeholderChar !== 'string' || options.placeholderChar.length > 1) {
            throw new Error('InputMask: placeholderChar should be a single character or an empty string.');
        }
        this.placeholderChar = options.placeholderChar;
        this.formatCharacters = mergeFormatCharacters(options.formatCharacters);
        this.setPattern(options.pattern, {
            value: options.value,
            selection: options.selection,
            isRevealingMask: options.isRevealingMask,
        });
    }
    // Editing
    /**
     * Applies a single character of input based on the current selection.
     * @param {string} char
     * @return {boolean} true if a change has been made to value or selection as a
     *   result of the input, false otherwise.
     */
    input(char) {
        // Ignore additional input if the cursor's at the end of the pattern
        if (this.selection.start === this.selection.end &&
            this.selection.start === this.pattern.length) {
            return false;
        }
        const selectionBefore = copy(this.selection);
        const valueBefore = this.getValue();
        let inputIndex = this.selection.start;
        // If the cursor or selection is prior to the first editable character, make
        // sure any input given is applied to it.
        if (inputIndex < this.pattern.firstEditableIndex) {
            inputIndex = this.pattern.firstEditableIndex;
        }
        // Bail out or add the character to input
        if (this.pattern.isEditableIndex(inputIndex)) {
            if (!this.pattern.isValidAtIndex(char, inputIndex)) {
                return false;
            }
            this.value[inputIndex] = this.pattern.transform(char, inputIndex);
        }
        // If multiple characters were selected, blank the remainder out based on the pattern.
        let end = this.selection.end - 1;
        while (end > inputIndex) {
            if (this.pattern.isEditableIndex(end)) {
                this.value[end] = this.placeholderChar;
            }
            end -= 1;
        }
        // Advance the cursor to the next character
        this.selection.start = inputIndex + 1;
        this.selection.end = inputIndex + 1;
        // Skip over any subsequent static characters
        while (this.pattern.length > this.selection.start &&
            !this.pattern.isEditableIndex(this.selection.start)) {
            this.selection.start += 1;
            this.selection.end += 1;
        }
        // History
        if (this.historyIndex != null) {
            // Took more input after undoing, so blow any subsequent history away
            this.history.splice(this.historyIndex, this.history.length - this.historyIndex);
            this.historyIndex = null;
        }
        if ((this.lastOp !== 'input') ||
            (selectionBefore.start !== selectionBefore.end) ||
            (this.lastSelection !== null && selectionBefore.start !== this.lastSelection.start)) {
            this.history.push({
                value: valueBefore,
                selection: selectionBefore,
                lastOp: this.lastOp,
            });
        }
        this.lastOp = 'input';
        this.lastSelection = copy(this.selection);
        return true;
    }
    /**
     * Attempts to delete from the value based on the current cursor position or
     * selection.
     * @return {boolean} true if the value or selection changed as the result of
     *   backspacing, false otherwise.
     */
    backspace() {
        // If the cursor is at the start there's nothing to do
        if (this.selection.start === 0 && this.selection.end === 0) {
            return false;
        }
        const selectionBefore = copy(this.selection);
        const valueBefore = this.getValue();
        // No range selected - work on the character preceding the cursor
        if (this.selection.start === this.selection.end) {
            if (this.pattern.isEditableIndex(this.selection.start - 1)) {
                if (this.pattern.isRevealingMask) {
                    this.value.splice(this.selection.start - 1);
                } else {
                    this.value[this.selection.start - 1] = this.placeholderChar;
                }
            }
            this.selection.start -= 1;
            this.selection.end -= 1;
        } else {
            // Range selected - delete characters and leave the cursor at the start of the selection
            let end = this.selection.end - 1;
            while (end >= this.selection.start) {
                if (this.pattern.isEditableIndex(end)) {
                    this.value[end] = this.placeholderChar;
                }
                end -= 1;
            }
            this.selection.end = this.selection.start;
        }
        // History
        if (this.historyIndex != null) {
            // Took more input after undoing, so blow any subsequent history away
            this.history.splice(this.historyIndex, this.history.length - this.historyIndex);
        }
        if (this.lastOp !== 'backspace' ||
            (selectionBefore.start !== selectionBefore.end) ||
            (this.lastSelection !== null && selectionBefore.start !== this.lastSelection.start)) {
            this.history.push({
                value: valueBefore,
                selection: selectionBefore,
                lastOp: this.lastOp,
            });
        }
        this.lastOp = 'backspace';
        this.lastSelection = copy(this.selection);
        return true;
    }
    /**
     * Attempts to paste a string of input at the current cursor position or over
     * the top of the current selection.
     * Invalid content at any position will cause the paste to be rejected, and it
     * may contain static parts of the mask's pattern.
     * @param {string} input
     * @return {boolean} true if the paste was successful, false otherwise.
     */
    paste(input) {
        // This is necessary because we're just calling input() with each character
        // and rolling back if any were invalid, rather than checking up-front.
        const initialState = {
            value: this.value.slice(),
            selection: copy(this.selection),
            lastOp: this.lastOp,
            history: this.history.slice(),
            historyIndex: this.historyIndex,
            lastSelection: copy(this.lastSelection),
        };
        // If there are static characters at the start of the pattern and the cursor
        // or selection is within them, the static characters must match for a valid paste.
        if (this.selection.start < this.pattern.firstEditableIndex) {
            for (let i = 0, l = this.pattern.firstEditableIndex - this.selection.start;
                i < l; i++
            ) {
                if (input.charAt(i) !== this.pattern.pattern[i]) {
                    return false;
                }
            }
            // Continue as if the selection and input started from the editable part of the pattern.
            // eslint-disable-next-line
            input = input.substring(this.pattern.firstEditableIndex - this.selection.start);
            this.selection.start = this.pattern.firstEditableIndex;
        }
        for (let i = 0, l = input.length;
            i < l && this.selection.start <= this.pattern.lastEditableIndex;
            i++
        ) {
            const valid = this.input(input.charAt(i));
            // Allow static parts of the pattern to appear in pasted input - they will
            // already have been stepped over by input(), so verify that the value
            // deemed invalid by input() was the expected static character.
            if (!valid) {
                if (this.selection.start > 0) {
                    // XXX This only allows for one static character to be skipped
                    const patternIndex = this.selection.start - 1;
                    if (!this.pattern.isEditableIndex(patternIndex) &&
                        input.charAt(i) === this.pattern.pattern[patternIndex]) {
                        // eslint-disable-next-line
                        continue;
                    }
                }
                extend(this, initialState);
                return false;
            }
        }
        return true;
    }
    // History
    undo() {
        // If there is no history, or nothing more on the history stack, we can't undo
        if (this.history.length === 0 || this.historyIndex === 0) {
            return false;
        }
        let historyItem;
        if (this.historyIndex == null) {
            // Not currently undoing, set up the initial history index
            this.historyIndex = this.history.length - 1;
            historyItem = this.history[this.historyIndex];
            // Add a new history entry if anything has changed since the last one, so we
            // can redo back to the initial state we started undoing from.
            const value = this.getValue();
            if (historyItem.value !== value ||
                historyItem.selection.start !== this.selection.start ||
                historyItem.selection.end !== this.selection.end) {
                this.history.push({
                    value,
                    selection: copy(this.selection),
                    lastOp: this.lastOp,
                    startUndo: true,
                });
            }
        } else {
            historyItem = this.history[--this.historyIndex]; // eslint-disable-line no-plusplus
        }
        this.value = historyItem.value.split('');
        this.selection = historyItem.selection;
        this.lastOp = historyItem.lastOp;
        return true;
    }
    redo() {
        if (this.history.length === 0 || this.historyIndex == null) {
            return false;
        }
        const historyItem = this.history[++this.historyIndex]; // eslint-disable-line no-plusplus
        // If this is the last history item, we're done redoing
        if (this.historyIndex === this.history.length - 1) {
            this.historyIndex = null;
            // If the last history item was only added to start undoing, remove it
            if (historyItem.startUndo) {
                this.history.pop();
            }
        }
        this.value = historyItem.value.split('');
        this.selection = historyItem.selection;
        this.lastOp = historyItem.lastOp;
        return true;
    }
    // Getters & setters
    setPattern(pattern, options) {
        // eslint-disable-next-line
        options = extend({
            selection: { start: 0, end: 0 },
            value: '',
        }, options);
        this.pattern = new Pattern(
            pattern,
            this.formatCharacters,
            this.placeholderChar,
            options.isRevealingMask,
        );
        this.setValue(options.value);
        this.emptyValue = this.pattern.formatValue([]).join('');
        this.selection = options.selection;
        this.resetHistory();
    }
    setSelection(selection) {
        this.selection = copy(selection);
        if (this.selection.start === this.selection.end) {
            if (this.selection.start < this.pattern.firstEditableIndex) {
                this.selection.start = this.pattern.firstEditableIndex;
                this.selection.end = this.pattern.firstEditableIndex;
                return true;
            }
            // Set selection to the first editable, non-placeholder character before the selection
            // OR to the beginning of the pattern
            let index = this.selection.start;
            while (index >= this.pattern.firstEditableIndex) {
                if (this.pattern.isEditableIndex(index - 1) &&
                    (this.value[index - 1] !== this.placeholderChar ||
                        index === this.pattern.firstEditableIndex)) {
                    this.selection.end = index;
                    this.selection.start = index;
                    break;
                }
                index -= 1;
            }
            return true;
        }
        return false;
    }
    setValue(value = '') {
        this.value = this.pattern.formatValue(value.split(''));
    }
    getValue() {
        if (this.pattern.isRevealingMask) {
            this.value = this.pattern.formatValue(this.getRawValue().split(''));
        }
        return this.value.join('');
    }
    getRawValue() {
        const rawValue = [];
        for (let i = 0; i < this.value.length; i++) {
            if (this.pattern.editableIndices[i] === true) {
                rawValue.push(this.value[i]);
            }
        }
        return rawValue.join('');
    }
    resetHistory() {
        this.history = [];
        this.historyIndex = null;
        this.lastOp = null;
        this.lastSelection = copy(this.selection);
    }
}

InputMask.Pattern = Pattern;

export default InputMask;
