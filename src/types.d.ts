import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // chessground draws pieces as <piece class="queen white">; reused in the promotion chooser.
      piece: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
