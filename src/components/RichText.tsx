import { Fragment } from 'react';

/** Renders plain text with **bold** spans and line breaks. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`whitespace-pre-line ${className ?? ''}`}>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith('**') ? (
          <b key={i} className="text-white">
            {part.slice(2, -2)}
          </b>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </div>
  );
}
