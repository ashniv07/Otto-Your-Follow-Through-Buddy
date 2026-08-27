// Realistic overdue Google Tasks for demo and fallback.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

module.exports = [
  {
    taskId: "mock-task-001",
    title: "Renew car registration",
    notes: "Registration expired. Pay online at DMV website or visit in person.",
    due: daysAgo(5),
    taskListTitle: "My Tasks",
  },
  {
    taskId: "mock-task-002",
    title: "Pay electricity bill - $142.50 due",
    notes: "Pacific Gas & Electric account #4521-3847. Pay at pge.com or call 1-800-743-5000.",
    due: daysAgo(2),
    taskListTitle: "Bills",
  },
  {
    taskId: "mock-task-003",
    title: "Submit Q3 expense report to finance team",
    notes: "Email completed report to finance@company.com. Total ~$450 in reimbursable expenses.",
    due: daysAgo(3),
    taskListTitle: "Work",
  },
  {
    taskId: "mock-task-004",
    title: "Follow up with Dr. Chen re: lab results",
    notes: "Called office on Monday, left voicemail. Need to schedule follow-up appointment.",
    due: daysAgo(7),
    taskListTitle: "Health",
  },
  {
    taskId: "mock-task-005",
    title: "Review and sign lease renewal agreement",
    notes:
      "Lease renewal for apartment at 123 Main St. Rent increases from $1,800 to $1,890/month. Respond by end of month.",
    due: daysAgo(1),
    taskListTitle: "Personal",
  },
  {
    taskId: "mock-task-006",
    title: "Tidy up desk and organize bookshelf",
    notes: "Just a quick personal tidy-up. No deadline, no one else involved.",
    due: daysAgo(3),
    taskListTitle: "Personal",
  },
];
