import type { ThemeContent } from "./types";

/**
 * Made-up sample people for theme demos. They exist only so a visitor can see a theme filled in; they never appear
 * on a user's page. Each is a different invented person, not one taken from the original sample sites.
 */

const NAMES: Record<string, { first: string; last: string; headline: string; current: string; place: string }> = {
  Product: { first: "Maya", last: "Rao", headline: "Product manager for small, sharp B2B tools", current: "Product Manager at Lumen Desk", place: "Pune, India" },
  Consulting: { first: "Arjun", last: "Nair", headline: "Strategy consultant focused on pricing and cost", current: "Associate at Northbridge Advisory", place: "Mumbai, India" },
  Operations: { first: "Tara", last: "Joshi", headline: "Operations lead who runs warehouses like clocks", current: "Operations Manager at Harbor Foods", place: "Bengaluru, India" },
  Marketing: { first: "Neel", last: "Verma", headline: "Brand marketer who writes the line and measures it", current: "Brand Manager at Kettle & Co", place: "Delhi, India" },
  Data: { first: "Isha", last: "Kulkarni", headline: "Data analyst who checks the number before the chart", current: "Senior Analyst at Orchard Metrics", place: "Hyderabad, India" },
  HR: { first: "Rohan", last: "Mehta", headline: "People partner who builds teams that stay", current: "HR Business Partner at Brightleaf", place: "Chennai, India" },
  Sales: { first: "Dev", last: "Malik", headline: "Enterprise seller who starts with the customer's problem", current: "Account Executive at Cloudwright", place: "Gurugram, India" },
  Finance: { first: "Anika", last: "Sethi", headline: "Deal analyst who reads the footnotes first", current: "Analyst at Meridian Capital", place: "Mumbai, India" },
  "Founder's Office": { first: "Kian", last: "Bose", headline: "Founder's office generalist who owns the unowned", current: "Chief of Staff at Paperkite", place: "Kolkata, India" },
};

export function sampleContent(profession: string): ThemeContent {
  const n = NAMES[profession] ?? NAMES["Product"]!;
  return {
    meta: { site_title: `${n.first} ${n.last} · ${n.headline}`, description: `${n.headline}.` },
    person: {
      first_name: n.first,
      last_name: n.last,
      headline: n.headline,
      current: n.current,
      looking_for: "A role where I can own an outcome end to end",
      location: n.place,
    },
    contact: { email: "hello@example.com", linkedin: "https://www.linkedin.com/in/sample-person" },
    pitch: {
      short: "I take messy problems, write them down plainly, and ship the fix.",
      why_hire: ["Writes things down so teams stay aligned", "Ships small, measures, then decides", "Calm when plans change"],
    },
    about: {
      intro: `This is a sample profile for the ${profession} theme. Your own resume replaces everything on this page.`,
      now: "Currently exploring what to build next.",
    },
    journey: [
      { year: "2019", title: "First job", detail: "Started on the front line and learned how the work really runs." },
      { year: "2022", title: "Moved into the role", detail: "Took ownership of a small area and grew it." },
      { year: "2025", title: "Today", detail: "Leading a team and looking for the next step." },
    ],
    education: [{ school: "Sample University", degree: "B.Tech", years: "2015 to 2019", notes: "Sample entry." }],
    experience: [
      {
        org: n.current.split(" at ")[1] ?? "Sample Co",
        role: n.current.split(" at ")[0] ?? "Role",
        place: n.place,
        dates: "2022 to now",
        points: ["Owned the weekly review and kept it short.", "Wrote the playbook the team now uses."],
      },
      {
        org: "First Company",
        role: "Associate",
        place: n.place,
        dates: "2019 to 2022",
        points: ["Learned the basics by doing the work."],
      },
    ],
    projects: [
      { title: "Sample project one", org: "Sample Co", year: "2024", role: "Lead", type: "Case", summary: "A short description of a sample project.", result: "A sample outcome.", tags: ["Sample"], tools: ["Sheets"] },
      { title: "Sample project two", org: "Sample Co", year: "2023", role: "Contributor", type: "Case", summary: "Another sample project.", result: "Another sample outcome.", tags: ["Sample"], tools: ["Docs"] },
    ],
    skills: { Core: ["Writing", "Planning", "Analysis"], Tools: ["Sheets", "Docs", "SQL"] },
    certifications: [{ name: "Sample certificate", issuer: "Sample Institute", year: "2024" }],
  };
}
