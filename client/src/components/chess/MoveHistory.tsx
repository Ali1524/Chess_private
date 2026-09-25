import { Fragment } from "react";

interface MoveHistoryProps {
  moves: string[];
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]]);
  }

  return (
    <div className="bg-bg rounded-lg border border-border p-2 max-h-28 overflow-y-auto">
      {pairs.length === 0 ? (
        <p className="text-text-secondary text-xs text-center py-2 opacity-60">No moves yet</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-sm font-mono">
          {pairs.map(([white, black], i) => (
            <Fragment key={i}>
              <span key={`n-${i}`} className="text-text-secondary text-xs flex items-center">{i + 1}.</span>
              <span key={`w-${i}`} className="text-text-primary text-xs flex items-center">{white}</span>
              <span key={`b-${i}`} className="text-text-secondary text-xs flex items-center">{black ?? ""}</span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
