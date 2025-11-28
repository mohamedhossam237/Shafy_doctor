import { Paper, Stack, Typography, Divider, Box } from "@mui/material";

export default function SectionCard({ id, icon, title, action, rtl, dense, children, bleedTop }) {
  return (
    <Paper
      id={id}
      elevation={0}
      sx={{
        p: dense ? 2 : 3,
        borderRadius: 4,
        mt: bleedTop ? -2 : 3,
        border: "1px solid",
        borderColor: "rgba(255, 255, 255, 0.6)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.05)",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
        "&:hover": {
          boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
        }
      }}
    >
      <Stack
        direction={rtl ? "row-reverse" : "row"}
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              p: 1.2,
              borderRadius: 2.5,
              background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" fontWeight={800} color="text.primary">
            {title}
          </Typography>
        </Stack>
        {action}
      </Stack>
      <Divider sx={{ mb: 2.5, opacity: 0.6 }} />
      {children}
    </Paper>
  );
}
