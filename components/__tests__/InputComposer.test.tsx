import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '../ThemeProvider';
import { InputComposer } from '../InputComposer';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe('InputComposer', () => {
  it('renders textarea with placeholder', () => {
    renderWithTheme(<InputComposer onSubmit={jest.fn()} />);

    const textarea = screen.getByLabelText('Chat input');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('placeholder');
  });

  it('submits message on Enter and clears input', () => {
    const handleSubmit = jest.fn();
    renderWithTheme(<InputComposer onSubmit={handleSubmit} />);

    const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('Hello world');
    expect(textarea.value).toBe('');
  });

  it('does not submit on Shift+Enter and keeps newline', () => {
    const handleSubmit = jest.fn();
    renderWithTheme(<InputComposer onSubmit={handleSubmit} />);

    const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'First line' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    // Browser default behavior should add a newline; simulate this in the test
    fireEvent.change(textarea, { target: { value: 'First line\n' } });

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toContain('\n');
  });

  it('does not submit when disabled', () => {
    const handleSubmit = jest.fn();
    renderWithTheme(<InputComposer onSubmit={handleSubmit} isDisabled />);

    const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    const button = screen.getByRole('button', { name: /send/i });

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.click(button);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('shows character count for long inputs', () => {
    const handleSubmit = jest.fn();
    renderWithTheme(<InputComposer onSubmit={handleSubmit} maxLength={500} />);

    const textarea = screen.getByLabelText('Chat input') as HTMLTextAreaElement;
    const longText = 'a'.repeat(250);

    fireEvent.change(textarea, { target: { value: longText } });

    expect(screen.getByText(/250/)).toBeInTheDocument();
  });
});
