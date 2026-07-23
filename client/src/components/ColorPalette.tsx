import { PALETTE } from "../types";

interface ColorPaletteProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorPalette({ selected, onSelect }: ColorPaletteProps) {
  return (
    <div className="palette" role="listbox" aria-label="Color palette">
      {PALETTE.map((color) => {
        const active = color.toLowerCase() === selected.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="option"
            aria-selected={active}
            className={`swatch${active ? " is-active" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => onSelect(color)}
            title={color}
          />
        );
      })}
    </div>
  );
}
