import { Paper, Stack, Typography, Box } from "@mui/material";

export default function InfoTile({ icon, title, value, rtl }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        height: "100%",
        bgcolor: "rgba(250,250,250,0.8)",
        "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
      }}
    >
      <Stack
        direction={rtl ? "row-reverse" : "row"}
        alignItems="center"
        spacing={1.5}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            bgcolor: "primary.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.main",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="body1" fontWeight={600}>
            {value || "—"}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
