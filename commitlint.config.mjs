export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // The default reads a subject opening with the product's own name as
    // Sentence case and rejects it. GRASP is spelled GRASP, so that check
    // comes off; the other three still hold.
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
  },
};
