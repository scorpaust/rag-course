import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatLayout } from '../ChatLayout';
import { ThemeProvider } from '../ThemeProvider';

describe('ChatLayout', () => {
  it('should render children in main area', () => {
    render(
      <ThemeProvider>
        <ChatLayout>
          <div data-testid="chat-content">Chat Content</div>
        </ChatLayout>
      </ThemeProvider>
    );

    expect(screen.getByTestId('chat-content')).toBeInTheDocument();
    expect(screen.getByTestId('chat-content')).toHaveTextContent(
      'Chat Content'
    );
  });

  it('should render citation panel when provided', () => {
    render(
      <ThemeProvider>
        <ChatLayout
          citationPanel={<div data-testid="citation-panel">Citations</div>}
        >
          <div>Chat Content</div>
        </ChatLayout>
      </ThemeProvider>
    );

    expect(screen.getByTestId('citation-panel')).toBeInTheDocument();
    expect(screen.getByTestId('citation-panel')).toHaveTextContent('Citations');
  });

  it('should render navigation rail when provided', () => {
    render(
      <ThemeProvider>
        <ChatLayout
          navigationRail={<div data-testid="nav-rail">Navigation</div>}
        >
          <div>Chat Content</div>
        </ChatLayout>
      </ThemeProvider>
    );

    expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
    expect(screen.getByTestId('nav-rail')).toHaveTextContent('Navigation');
  });

  it('should render all sections when all props provided', () => {
    render(
      <ThemeProvider>
        <ChatLayout
          navigationRail={<div data-testid="nav-rail">Navigation</div>}
          citationPanel={<div data-testid="citation-panel">Citations</div>}
        >
          <div data-testid="chat-content">Chat Content</div>
        </ChatLayout>
      </ThemeProvider>
    );

    expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
    expect(screen.getByTestId('chat-content')).toBeInTheDocument();
    expect(screen.getByTestId('citation-panel')).toBeInTheDocument();
  });
});
