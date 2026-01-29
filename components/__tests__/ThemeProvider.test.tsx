import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeProvider';

// Test component that uses the theme
function TestComponent() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme-mode">{theme.mode}</div>
      <div data-testid="background-color">{theme.colors.background}</div>
      <button onClick={toggleTheme} data-testid="toggle-button">
        Toggle
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render with light theme by default', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light');
    expect(screen.getByTestId('background-color')).toHaveTextContent('#ffffff');
  });

  it('should toggle between light and dark themes', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId('toggle-button');

    // Initially light
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light');

    // Toggle to dark
    act(() => {
      toggleButton.click();
    });
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('background-color')).toHaveTextContent('#1a1a1a');

    // Toggle back to light
    act(() => {
      toggleButton.click();
    });
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('light');
  });

  it('should throw error when useTheme is used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });
});
