import { Paper, Stack, Typography, Box } from "@mui/material";

export default function InfoTile({ icon, title, value, rtl }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        height: "100%",
        bgcolor: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.5)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
          bgcolor: "rgba(255,255,255,0.9)",
          borderColor: "rgba(255,255,255,0.8)"
        },
      }}
    >
      <Stack
        direction={rtl ? "row-reverse" : "row"}
        alignItems="center"
        spacing={2}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            background: "linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.main",
            border: "1px solid rgba(25, 118, 210, 0.1)",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body1" fontWeight={800} color="text.primary">
            {value || "—"}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
