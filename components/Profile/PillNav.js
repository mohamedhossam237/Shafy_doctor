import { Tabs, Tab } from "@mui/material";

export default function PillNav({ rtl, items }) {
  return (
    <Tabs
      variant="scrollable"
      scrollButtons="auto"
      sx={{
        "& .MuiTab-root": {
          borderRadius: "30px",
          textTransform: "none",
          fontWeight: 600,
          minHeight: 36,
          px: 2.5,
          mr: 1,
        },
        "& .Mui-selected": {
          bgcolor: "primary.main",
          color: "primary.contrastText",
        },
      }}
    >
      {items.map((item) => (
        <Tab key={item.id} icon={item.icon} iconPosition="start" label={item.label} />
      ))}
    </Tabs>
  );
}
