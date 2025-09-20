import { Stack, Chip } from "@mui/material";

export default function ChipGroup({ items }) {
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {items.map((item, i) => (
        <Chip
          key={i}
          label={item}
          variant="outlined"
          sx={{
            fontWeight: 500,
            borderRadius: 2,
            "&:hover": { bgcolor: "primary.light", color: "primary.main" },
          }}
        />
      ))}
    </Stack>
  );
}
