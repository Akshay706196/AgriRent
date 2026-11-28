import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinInput } from '../components/ui/PinInput';

describe('PinInput Component', () => {
  it('renders 6 input boxes by default', () => {
    const handleChange = vi.fn();
    render(<PinInput value="" onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('displays provided digits in the boxes', () => {
    const handleChange = vi.fn();
    render(<PinInput value="123456" onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs[0].value).toBe('1');
    expect(inputs[1].value).toBe('2');
    expect(inputs[2].value).toBe('3');
    expect(inputs[3].value).toBe('4');
    expect(inputs[4].value).toBe('5');
    expect(inputs[5].value).toBe('6');
  });

  it('calls onChange with updated digit when user types', () => {
    const handleChange = vi.fn();
    render(<PinInput value="" onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '7' } });

    expect(handleChange).toHaveBeenCalledWith('7');
  });

  it('handles paste of 6 digits correctly', () => {
    const handleChange = vi.fn();
    render(<PinInput value="" onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => '839201',
      },
    });

    expect(handleChange).toHaveBeenCalledWith('839201');
  });
});
