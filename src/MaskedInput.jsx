/**
 * Component MaskedInput
 * https://github.com/MaximusFT/react-maskedinput
 *
 * @author MaximusFT <maximusft@gmail.com>
 */

import React from 'react';
import PropTypes from 'prop-types';
import InputMask from './InputMask';
import { setDateMask } from './utils';

const KEYCODE_Z = 90;
const KEYCODE_Y = 89;

function isUndo(e) {
    return (e.ctrlKey || e.metaKey) && e.keyCode === (e.shiftKey ? KEYCODE_Y : KEYCODE_Z);
}

function isRedo(e) {
    return (e.ctrlKey || e.metaKey) && e.keyCode === (e.shiftKey ? KEYCODE_Z : KEYCODE_Y);
}

function getSelection(el) {
    let start;
    let end;
    if (el.selectionStart !== undefined) {
        start = el.selectionStart;
        end = el.selectionEnd;
    } else {
        try {
            el.focus();
            const rangeEl = el.createTextRange();
            const clone = rangeEl.duplicate();

            rangeEl.moveToBookmark(document.selection.createRange().getBookmark());
            clone.setEndPoint('EndToStart', rangeEl);

            start = clone.text.length;
            end = start + rangeEl.text.length;
        } catch (e) { /* not focused or not visible */ }
    }

    return { start, end };
}

function setSelection(el, selection) {
    try {
        if (el.selectionStart !== undefined) {
            el.focus();
            el.setSelectionRange(selection.start, selection.end);
        } else {
            el.focus();
            const rangeEl = el.createTextRange();
            rangeEl.collapse(true);
            rangeEl.moveStart('character', selection.start);
            rangeEl.moveEnd('character', selection.end - selection.start);
            rangeEl.select();
        }
    } catch (e) { /* not focused or not visible */ }
}

export default class MaskedInput extends React.Component {

    componentWillMount() {
        const { isDateMask, formatCharacters, placeholderChar, value, mask } = this.props;
        const options = {
            pattern: isDateMask ? setDateMask() : mask,
            value,
            formatCharacters,
        };
        if (placeholderChar) options.placeholderChar = placeholderChar;
        this.mask = new InputMask(options);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.mask !== nextProps.mask && this.props.value !== nextProps.mask) {
            // if we get a new value and a new mask at the same time
            // check if the mask.value is still the initial value
            // - if so use the nextProps value
            // - otherwise the `this.mask` has a value for us (most likely from paste action)
            if (this.mask.getValue() === this.mask.emptyValue) {
                this.mask.setPattern(nextProps.mask, { value: nextProps.value });
            } else {
                this.mask.setPattern(nextProps.mask, { value: this.mask.getRawValue() });
            }
        } else if (this.props.mask !== nextProps.mask) {
            this.mask.setPattern(nextProps.mask, { value: this.mask.getRawValue() });
        } else if (this.props.value !== nextProps.value) {
            this.mask.setValue(nextProps.value);
        }
    }

    componentWillUpdate(nextProps) {
        if (nextProps.mask !== this.props.mask) {
            this.updatePattern(nextProps);
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.mask !== this.props.mask && this.mask.selection.start) {
            this.updateInputSelection();
        }
    }

    updatePattern(props) {
        this.mask.setPattern(props.mask, {
            value: this.mask.getRawValue(),
            selection: getSelection(this.input),
        });
    }

    updateMaskSelection() {
        this.mask.selection = getSelection(this.input);
    }

    updateInputSelection() {
        setSelection(this.input, this.mask.selection);
    }

    onChange = e => {
        const maskValue = this.mask.getValue();
        const incomingValue = e.target.value;
        if (incomingValue !== maskValue) { // only modify mask if form contents actually changed
            this.updateMaskSelection();
            this.mask.setValue(incomingValue); // write the whole updated value into the mask
            // update the form with pattern applied to the value
            e.target.value = this.getDisplayValue();
            this.updateInputSelection();
        }

        if (this.props.onChange) {
            this.props.onChange(e);
        }
    }

    onKeyDown = e => {
        if (isUndo(e)) {
            e.preventDefault();
            if (this.mask.undo()) {
                e.target.value = this.getDisplayValue();
                this.updateInputSelection();
                if (this.props.onChange) {
                    this.props.onChange(e);
                }
            }
            return;
        } else if (isRedo(e)) {
            e.preventDefault();
            if (this.mask.redo()) {
                e.target.value = this.getDisplayValue();
                this.updateInputSelection();
                if (this.props.onChange) {
                    this.props.onChange(e);
                }
            }
            return;
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            this.updateMaskSelection();
            if (this.mask.backspace()) {
                const value = this.getDisplayValue();
                e.target.value = value;
                if (value) {
                    this.updateInputSelection();
                }
                if (this.props.onChange) {
                    this.props.onChange(e);
                }
            }
        }
    }

    onKeyPress = e => {
        // Ignore modified key presses
        // Ignore enter key to allow form submission
        if (e.metaKey || e.altKey || e.ctrlKey || e.key === 'Enter') { return; }
        e.preventDefault();
        this.updateMaskSelection();
        if (this.mask.input((e.key || e.data))) {
            e.target.value = this.mask.getValue();
            this.updateInputSelection();
            if (this.props.onChange) {
                this.props.onChange(e);
            }
        }
    }

    onPaste = e => {
        e.preventDefault();
        this.updateMaskSelection();
        // getData value needed for IE also works in FF & Chrome
        if (this.mask.paste(e.clipboardData.getData('Text'))) {
            e.target.value = this.mask.getValue();
            // Timeout needed for IE
            setTimeout(() => this.updateInputSelection(), 0);
            if (this.props.onChange) {
                this.props.onChange(e);
            }
        }
    }

    getDisplayValue() {
        const value = this.mask.getValue();
        return value === this.mask.emptyValue ? '' : value;
    }

    keyPressPropName() {
        if (typeof navigator !== 'undefined') {
            return navigator.userAgent.match(/Android/i)
                ? 'onBeforeInput'
                : 'onKeyPress';
        }
        return 'onKeyPress';
    }

    getEventHandlers() {
        return {
            onChange: this.onChange,
            onKeyDown: this.onKeyDown,
            onPaste: this.onPaste,
            [this.keyPressPropName()]: this.onKeyPress,
        };
    }

    focus() {
        this.input.focus();
    }

    blur() {
        this.input.blur();
    }

    render() {
        const ref = r => { this.input = r; };
        const maxLength = this.mask.pattern.length;
        const value = this.getDisplayValue();
        const eventHandlers = this.getEventHandlers();
        const { size = maxLength, placeholder = this.mask.emptyValue } = this.props;

        // eslint-disable-next-line no-unused-vars
        const {
            placeholderChar,
            formatCharacters,
            isDateMask,
            className,
            ...cleanedProps
        } = this.props;

        const inputProps = {
            ...cleanedProps,
            ...eventHandlers,
            ref,
            maxLength,
            value,
            size,
            placeholder,
        };

        return <input className={className} {...inputProps} />;
    }
}

MaskedInput.defaultProps = {
    value: '',
    isDateMask: false,
};

MaskedInput.propTypes = {
    className: PropTypes.string,
    // eslint-disable-next-line react/forbid-prop-types
    formatCharacters: PropTypes.object,
    isDateMask: PropTypes.bool, // When is props is Set, prop.mask is Dynamicle from User Language
    mask: PropTypes.string,
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
    placeholderChar: PropTypes.string,
    size: PropTypes.number,
    value: PropTypes.string,
};
