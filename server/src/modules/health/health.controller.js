const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: "The Sixth Studio API is running successfully.",
    timestamp: new Date().toISOString(),
  });
};

export { healthCheck };
