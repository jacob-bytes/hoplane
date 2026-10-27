import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/select-native";
import {
  parseTrafficInput,
  TRAFFIC_UNIT_MIB,
  type TrafficUnit,
} from "@/utils/traffic";

const UNITS: TrafficUnit[] = ["MB", "GB", "TB", "PB"];

interface TrafficLimitFieldProps {
  label: string;
  value: string;
  unit: TrafficUnit;
  onChange: (value: string, unit: TrafficUnit) => void;
  description?: string;
  isRequired?: boolean;
}

export function TrafficLimitField({
  label,
  value,
  unit,
  onChange,
  description,
  isRequired,
}: TrafficLimitFieldProps) {
  const id = useId();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>
          {label}
          {isRequired ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        <Input
          id={id}
          min="0"
          required={isRequired}
          step="any"
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value, unit)}
        />
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <SelectField
        aria-label={`${label}单位`}
        label="单位"
        options={UNITS.map((option) => ({ value: option, label: option }))}
        value={unit}
        onValueChange={(nextUnit) => {
          const mib = parseTrafficInput(value, unit);

          onChange(
            mib === null
              ? value
              : String(mib / TRAFFIC_UNIT_MIB[nextUnit as TrafficUnit]),
            nextUnit as TrafficUnit,
          );
        }}
      />
    </div>
  );
}
