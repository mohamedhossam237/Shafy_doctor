import { Paper, Stack, Typography, Divider, Box } from "@mui/material";

export default function SectionCard({ id, icon, title, action, rtl, dense, children, bleedTop }) {
  return (
    <Paper
      id={id}
      elevation={0}
      sx={{
        p: dense ? 1.5 : 2.5,
        borderRadius: 3,
        mt: bleedTop ? -2 : 2,
        border: "1px solid",
        borderColor: "divider",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(6px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
      }}
    >
      <Stack
        direction={rtl ? "row-reverse" : "row"}
        alignItems="center"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>
          <Typography variant="subtitle1" fontWeight={900}>
            {title}
          </Typography>
        </Stack>
        {action}
      </Stack>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Paper>
  );
}
