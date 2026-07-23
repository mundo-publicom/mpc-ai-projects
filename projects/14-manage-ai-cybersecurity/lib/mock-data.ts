/**
 * Realistic seed data for the SOC dashboard demo. Represents a snapshot of a
 * fictional SMB ("Northwind Trading Co.") environment: its monitored assets,
 * a feed of recent security alerts, and the standing posture findings.
 *
 * All data is synthetic and defensive in nature — alerts describe activity to
 * DETECT and RESPOND to, never instructions to carry anything out.
 */

import type { Alert, Asset, Finding } from "./types";

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export const MOCK_ASSETS: Asset[] = [
  {
    id: "ast-fin-db01",
    name: "fin-db01 (Finance SQL)",
    type: "server",
    criticality: "crown_jewel",
    owner: "Finance IT",
    tags: ["pci", "production", "database"],
    lastSeen: "2026-07-23T09:41:00Z",
  },
  {
    id: "ast-dc01",
    name: "dc01 (Domain Controller)",
    type: "server",
    criticality: "crown_jewel",
    owner: "IT Ops",
    tags: ["production", "identity"],
    lastSeen: "2026-07-23T09:52:00Z",
  },
  {
    id: "ast-lt-4412",
    name: "LT-4412 (J. Rivera laptop)",
    type: "endpoint",
    criticality: "standard",
    owner: "Sales",
    tags: ["byod-adjacent", "remote"],
    lastSeen: "2026-07-23T09:15:00Z",
  },
  {
    id: "ast-okta",
    name: "Okta (Identity Provider)",
    type: "identity",
    criticality: "crown_jewel",
    owner: "IT Ops",
    tags: ["sso", "identity"],
    lastSeen: "2026-07-23T09:58:00Z",
  },
  {
    id: "ast-web-prod",
    name: "web-prod (Public marketing site)",
    type: "cloud_workload",
    criticality: "high",
    owner: "Marketing Eng",
    tags: ["internet-facing", "aws"],
    lastSeen: "2026-07-23T09:33:00Z",
  },
  {
    id: "ast-m365",
    name: "Microsoft 365 tenant",
    type: "saas_app",
    criticality: "high",
    owner: "IT Ops",
    tags: ["email", "collaboration"],
    lastSeen: "2026-07-23T09:59:00Z",
  },
];

/* ------------------------------------------------------------------ */
/* Alerts (unTriaged raw feed)                                         */
/* ------------------------------------------------------------------ */

export const MOCK_ALERTS: Alert[] = [
  {
    id: "alt-1001",
    timestamp: "2026-07-23T09:48:12Z",
    source: "edr",
    title: "Shadow copy deletion via vssadmin",
    description:
      "Process vssadmin.exe deleted volume shadow copies on fin-db01, followed by rapid file modification across multiple directories. Pattern consistent with ransomware staging.",
    reportedSeverity: "high",
    assetId: "ast-fin-db01",
    assetName: "fin-db01 (Finance SQL)",
    indicators: {
      host: "fin-db01",
      process: "vssadmin.exe",
      user: "svc_sqlbackup",
    },
    status: "new",
  },
  {
    id: "alt-1002",
    timestamp: "2026-07-23T09:31:47Z",
    source: "identity",
    title: "Multiple failed logins then success (Okta)",
    description:
      "42 failed sign-in attempts against user j.rivera@northwind.co from a single IP over 6 minutes, followed by one successful login. Possible password spray / brute force.",
    reportedSeverity: "medium",
    assetId: "ast-okta",
    assetName: "Okta (Identity Provider)",
    indicators: {
      user: "j.rivera@northwind.co",
      sourceIp: "185.220.101.44",
    },
    status: "new",
  },
  {
    id: "alt-1003",
    timestamp: "2026-07-23T08:59:03Z",
    source: "email",
    title: "Suspicious email: credential-harvesting link",
    description:
      "Inbound message spoofing the M365 login page delivered to 7 mailboxes. Sender domain registered 2 days ago; embedded URL mimics login.microsoftonline.com.",
    reportedSeverity: "medium",
    assetId: "ast-m365",
    assetName: "Microsoft 365 tenant",
    indicators: {
      domain: "micros0ft-login-secure.com",
      user: "multiple",
    },
    status: "new",
  },
  {
    id: "alt-1004",
    timestamp: "2026-07-23T07:22:55Z",
    source: "edr",
    title: "Encoded PowerShell command executed",
    description:
      "powershell.exe launched with a base64 -EncodedCommand argument on LT-4412. Parent process was a signed IT automation agent; no network callbacks observed.",
    reportedSeverity: "high",
    assetId: "ast-lt-4412",
    assetName: "LT-4412 (J. Rivera laptop)",
    indicators: {
      host: "LT-4412",
      process: "powershell.exe",
      user: "j.rivera",
    },
    status: "new",
  },
  {
    id: "alt-1005",
    timestamp: "2026-07-23T06:05:19Z",
    source: "firewall",
    title: "External port scan against perimeter",
    description:
      "Sequential connection attempts to 1,000+ TCP ports on the public IP range from a single external host. No services responded on scanned ports.",
    reportedSeverity: "low",
    assetId: "ast-web-prod",
    assetName: "web-prod (Public marketing site)",
    indicators: {
      sourceIp: "45.155.205.233",
    },
    status: "new",
  },
  {
    id: "alt-1006",
    timestamp: "2026-07-23T05:40:02Z",
    source: "cloud",
    title: "New global admin role assigned (M365)",
    description:
      "User h.patel@northwind.co was granted the Global Administrator role in Entra ID. Change occurred outside business hours with no linked change ticket.",
    reportedSeverity: "medium",
    assetId: "ast-m365",
    assetName: "Microsoft 365 tenant",
    indicators: {
      user: "h.patel@northwind.co",
    },
    status: "new",
  },
  {
    id: "alt-1007",
    timestamp: "2026-07-23T04:12:38Z",
    source: "siem",
    title: "Unusual outbound data volume to unknown host",
    description:
      "fin-db01 transferred 6.2 GB over HTTPS to an external host not seen before. Volume is 20x the host's daily baseline; occurred in a single 15-minute window.",
    reportedSeverity: "high",
    assetId: "ast-fin-db01",
    assetName: "fin-db01 (Finance SQL)",
    indicators: {
      host: "fin-db01",
      destinationIp: "91.219.236.18",
    },
    status: "new",
  },
  {
    id: "alt-1008",
    timestamp: "2026-07-23T03:58:11Z",
    source: "edr",
    title: "Expected: scheduled maintenance script (known good)",
    description:
      "Approved nightly maintenance script ran on dc01 during the documented maintenance window. Matches the known-good baseline; flagged only for completeness.",
    reportedSeverity: "info",
    assetId: "ast-dc01",
    assetName: "dc01 (Domain Controller)",
    indicators: {
      host: "dc01",
      process: "maintenance.ps1",
      user: "svc_maint",
    },
    status: "new",
  },
];

/* ------------------------------------------------------------------ */
/* Posture findings                                                    */
/* ------------------------------------------------------------------ */

export const MOCK_FINDINGS: Finding[] = [
  {
    id: "fnd-001",
    category: "identity",
    title: "MFA not enforced for 3 admin accounts",
    severity: "critical",
    affectedAssetIds: ["ast-okta", "ast-m365"],
    resolved: false,
  },
  {
    id: "fnd-002",
    category: "identity",
    title: "12 stale accounts inactive > 90 days still enabled",
    severity: "medium",
    affectedAssetIds: ["ast-okta"],
    resolved: false,
  },
  {
    id: "fnd-003",
    category: "vulnerability",
    title: "Internet-facing host missing critical CVE patch (KEV-listed)",
    severity: "critical",
    affectedAssetIds: ["ast-web-prod"],
    resolved: false,
  },
  {
    id: "fnd-004",
    category: "vulnerability",
    title: "17 high-severity CVEs outstanding past SLA",
    severity: "high",
    affectedAssetIds: ["ast-fin-db01", "ast-dc01"],
    resolved: false,
  },
  {
    id: "fnd-005",
    category: "misconfiguration",
    title: "S3 bucket with public read on marketing assets",
    severity: "high",
    affectedAssetIds: ["ast-web-prod"],
    resolved: false,
  },
  {
    id: "fnd-006",
    category: "endpoint_hygiene",
    title: "EDR agent not reporting on 4 endpoints",
    severity: "high",
    affectedAssetIds: ["ast-lt-4412"],
    resolved: false,
  },
  {
    id: "fnd-007",
    category: "endpoint_hygiene",
    title: "Disk encryption disabled on 2 laptops",
    severity: "medium",
    affectedAssetIds: ["ast-lt-4412"],
    resolved: false,
  },
  {
    id: "fnd-008",
    category: "exposure",
    title: "RDP exposed to the internet on one host",
    severity: "high",
    affectedAssetIds: ["ast-fin-db01"],
    resolved: false,
  },
  {
    id: "fnd-009",
    category: "backup_recovery",
    title: "No tested offline/immutable backup for finance DB",
    severity: "high",
    affectedAssetIds: ["ast-fin-db01"],
    resolved: false,
  },
  {
    id: "fnd-010",
    category: "logging_visibility",
    title: "Cloud audit logs not forwarded to SIEM",
    severity: "medium",
    affectedAssetIds: ["ast-m365", "ast-web-prod"],
    resolved: false,
  },
  {
    id: "fnd-011",
    category: "misconfiguration",
    title: "Default credentials removed from network switch",
    severity: "medium",
    affectedAssetIds: ["ast-dc01"],
    resolved: true,
  },
  {
    id: "fnd-012",
    category: "identity",
    title: "Legacy IMAP auth disabled tenant-wide",
    severity: "high",
    affectedAssetIds: ["ast-m365"],
    resolved: true,
  },
];

/** Previous overall posture score, used to render a trend delta in the demo. */
export const MOCK_PREVIOUS_POSTURE_SCORE = 58;
