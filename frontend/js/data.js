// Specializations -> lessons (in order) -> learning links.
// Add or edit freely: [label, url, kind]
const r = (a, u) => [a, u, "Read"], w = (a, u) => [a, u, "Watch"], p = (a, u) => [a, u, "Practice"];
const L = (t, s, m, ...l) => ({ t, s, m, l });

const SPECS = [
  { id: "foundations", name: "Foundations", acc: "#2fc4f0",
    blurb: "Linux, networking and security basics. The base for everything else.",
    lessons: [
      L("Security basics", "The CIA triad, threats, risk and how attackers think.", 30, w("Professor Messer", "https://www.professormesser.com/"), r("NIST Cybersecurity Framework", "https://www.nist.gov/cyberframework")),
      L("The Linux command line", "Files, permissions, processes and pipes.", 60, r("Linux Journey", "https://linuxjourney.com/"), p("OverTheWire: Bandit", "https://overthewire.org/wargames/bandit/")),
      L("Networking essentials", "IP, TCP, DNS and HTTP, and what travels on the wire.", 60, r("Cloudflare Learning Center", "https://www.cloudflare.com/learning/"), p("Wireshark", "https://www.wireshark.org/")),
      L("Cryptography basics", "Hashing, encryption, keys and certificates in plain language.", 45, w("Khan Academy: Cryptography", "https://www.khanacademy.org/computing/computer-science/cryptography"), p("Cryptopals", "https://cryptopals.com/")),
      L("Passwords and auth", "Why passwords fail and how MFA and hashing fix it.", 30, r("OWASP Authentication Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html"), p("Have I Been Pwned", "https://haveibeenpwned.com/")),
      L("Your first lab", "Spin up a safe practice room and capture your first flag.", 60, p("TryHackMe", "https://tryhackme.com/"), p("Hack The Box Academy", "https://academy.hackthebox.com/"))
    ] },
  { id: "web", name: "Web Security", acc: "#7a9cff",
    blurb: "Find and fix the flaws behind most real-world breaches.",
    lessons: [
      L("How the web works", "Requests, cookies, sessions and the browser security model.", 45, r("MDN: HTTP", "https://developer.mozilla.org/en-US/docs/Web/HTTP"), p("Burp Suite Community", "https://portswigger.net/burp/communitydownload")),
      L("The OWASP Top 10", "The ten most common web risks and what they look like.", 40, r("OWASP Top 10", "https://owasp.org/www-project-top-ten/"), p("OWASP Juice Shop", "https://owasp.org/www-project-juice-shop/")),
      L("SQL injection", "How unsafe queries leak data and how to prevent it.", 60, r("PortSwigger: SQL injection", "https://portswigger.net/web-security/sql-injection"), r("OWASP SQLi Prevention", "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html")),
      L("Cross-site scripting", "Reflected, stored and DOM XSS, plus output encoding.", 60, r("PortSwigger: XSS", "https://portswigger.net/web-security/cross-site-scripting"), r("OWASP XSS Prevention", "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html")),
      L("Access control flaws", "Broken authorization, IDOR and privilege checks.", 50, r("PortSwigger: Access control", "https://portswigger.net/web-security/access-control"), p("Web Security Academy", "https://portswigger.net/web-security")),
      L("Building securely", "Turn what you found into habits: validation, headers, ASVS.", 45, r("OWASP ASVS", "https://owasp.org/www-project-application-security-verification-standard/"), r("OWASP Cheat Sheets", "https://cheatsheetseries.owasp.org/"))
    ] },
  { id: "network", name: "Network Security", acc: "#35d6c0",
    blurb: "Understand traffic, spot attacks and defend the wire.",
    lessons: [
      L("Network models", "OSI and TCP/IP layers and where attacks fit in.", 45, r("Cisco Networking Academy", "https://www.netacad.com/"), r("Cloudflare: The OSI model", "https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/")),
      L("Packet analysis", "Read traffic with Wireshark and spot what is off.", 60, r("Wireshark docs", "https://www.wireshark.org/docs/"), p("Malware Traffic Analysis", "https://www.malware-traffic-analysis.net/")),
      L("Scanning your own network", "Discover hosts and services in a lab you own or may test.", 60, r("The Nmap book", "https://nmap.org/book/"), p("TryHackMe: Nmap", "https://tryhackme.com/room/furthernmap")),
      L("Firewalls and IDS", "Rules, signatures and detecting hostile traffic.", 50, r("Snort documentation", "https://www.snort.org/documents"), r("Suricata documentation", "https://suricata.io/documentation/")),
      L("Secure protocols", "TLS, VPNs and why encryption in transit matters.", 40, r("Cloudflare: What is TLS?", "https://www.cloudflare.com/learning/ssl/transport-layer-security-tls/"), p("Qualys SSL Labs", "https://www.ssllabs.com/ssltest/")),
      L("Defense lab", "Monitor a small network and catch simulated attacks.", 90, p("Security Onion", "https://securityonionsolutions.com/"), p("TryHackMe", "https://tryhackme.com/"))
    ] },
  { id: "pentest", name: "Ethical Hacking", acc: "#ff7a8a",
    blurb: "Think like an attacker, legally, to find weaknesses first.",
    lessons: [
      L("Rules, scope and law", "Authorization, rules of engagement and staying legal.", 30, r("NIST SP 800-115", "https://csrc.nist.gov/pubs/sp/800/115/final"), r("PTES standard", "http://www.pentest-standard.org/")),
      L("Reconnaissance", "Open-source intelligence on targets you may assess.", 45, r("OSINT Framework", "https://osintframework.com/"), p("Shodan", "https://www.shodan.io/")),
      L("Vulnerability assessment", "Find known weaknesses and rank them by risk.", 60, r("National Vulnerability Database", "https://nvd.nist.gov/"), p("Greenbone (OpenVAS)", "https://www.greenbone.net/en/community-edition/")),
      L("Exploitation in safe labs", "Practice on intentionally vulnerable machines.", 90, p("Hack The Box Academy", "https://academy.hackthebox.com/"), p("VulnHub", "https://www.vulnhub.com/")),
      L("Privilege escalation", "Go from a foothold to full control, and how to stop it.", 75, r("GTFOBins", "https://gtfobins.github.io/"), r("MITRE ATT&CK", "https://attack.mitre.org/")),
      L("Writing the report", "Findings, evidence and fixes a client can act on.", 45, r("Public pentest reports", "https://github.com/juliocesarfort/public-pentesting-reports"), r("OWASP Testing Guide", "https://owasp.org/www-project-web-security-testing-guide/"))
    ] },
  { id: "blue", name: "Blue Team and Forensics", acc: "#6fe08d",
    blurb: "Detect, investigate and respond when something goes wrong.",
    lessons: [
      L("Inside a SOC", "Roles, alerts and the analyst's daily workflow.", 30, r("MITRE ATT&CK", "https://attack.mitre.org/"), p("LetsDefend", "https://letsdefend.io/")),
      L("Logs and SIEM", "Collect, search and make sense of event data.", 60, w("Splunk free courses", "https://www.splunk.com/en_us/training/free-courses/overview.html"), r("Elastic Security", "https://www.elastic.co/security")),
      L("Detection and hunting", "Write detections and hunt for what alerts miss.", 75, r("Sigma rules", "https://github.com/SigmaHQ/sigma"), p("CyberDefenders", "https://cyberdefenders.org/")),
      L("Incident response", "Prepare, contain, eradicate, recover and learn.", 50, r("NIST SP 800-61", "https://csrc.nist.gov/pubs/sp/800/61/r2/final"), r("SANS Reading Room", "https://www.sans.org/white-papers/")),
      L("Digital forensics", "Preserve evidence and recover what happened.", 75, r("The Sleuth Kit", "https://www.sleuthkit.org/"), p("Autopsy", "https://www.autopsy.com/")),
      L("Blue team challenge", "Investigate a full simulated breach end to end.", 90, p("Blue Team Labs Online", "https://blueteamlabs.online/"), p("Security Blue Team", "https://securityblue.team/"))
    ] },
  { id: "cloud", name: "Cloud Security", acc: "#b48cff",
    blurb: "Lock down accounts, data and workloads in the cloud.",
    lessons: [
      L("Shared responsibility", "What the provider secures and what is on you.", 30, r("AWS shared responsibility", "https://aws.amazon.com/compliance/shared-responsibility-model/"), r("Microsoft Learn: Security", "https://learn.microsoft.com/en-us/security/")),
      L("Identity and access", "Least privilege, roles and policies done right.", 50, r("AWS IAM best practices", "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html"), p("flaws.cloud", "https://flaws.cloud/")),
      L("Data and secrets", "Storage permissions, encryption and secrets handling.", 45, r("OWASP Secrets Management", "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"), p("flaws2.cloud", "https://flaws2.cloud/")),
      L("Containers and Kubernetes", "Harden images, clusters and runtime.", 60, r("Kubernetes security", "https://kubernetes.io/docs/concepts/security/"), r("CIS Benchmarks", "https://www.cisecurity.org/cis-benchmarks")),
      L("Finding misconfigurations", "Audit an account automatically and fix what it finds.", 60, p("Prowler", "https://github.com/prowler-cloud/prowler"), p("ScoutSuite", "https://github.com/nccgroup/ScoutSuite")),
      L("Attack and defend lab", "Break a deliberately weak cloud, then lock it down.", 90, p("CloudGoat", "https://github.com/RhinoSecurityLabs/cloudgoat"), p("TryHackMe", "https://tryhackme.com/"))
    ] }
];

// Quick quizzes: { q: question, o: options, a: index of the right option, e: why }
const QUIZZES = {
  foundations: [
    { q: "Which part of the CIA triad does encryption mainly protect?", o: ["Availability", "Confidentiality", "Integrity", "Accountability"], a: 1, e: "Encryption keeps data unreadable to anyone without the key, which is confidentiality." },
    { q: "Which Linux command prints the directory you are in?", o: ["ls", "cd", "pwd", "whoami"], a: 2, e: "pwd stands for print working directory." },
    { q: "Which protocol turns a domain name into an IP address?", o: ["DHCP", "DNS", "ARP", "ICMP"], a: 1, e: "DNS is the internet's phone book for names and addresses." },
    { q: "Why store passwords as salted hashes instead of plain text?", o: ["So they can be emailed if forgotten", "So logins run faster", "So a database leak does not directly reveal passwords", "So passwords never expire"], a: 2, e: "Hashes cannot be reversed easily, and salts stop attackers reusing precomputed tables." }
  ],
  web: [
    { q: "What is the best primary defense against SQL injection?", o: ["Hiding error messages", "Longer passwords", "Blocking the word SELECT", "Parameterized queries"], a: 3, e: "Parameterized queries keep user input as data, never as part of the SQL command." },
    { q: "Which describes stored XSS?", o: ["Malicious script saved on the server and run for later visitors", "A stolen password database", "A cookie that never expires", "A slow server response"], a: 0, e: "Stored XSS persists on the server, so every visitor who loads the content runs the script." },
    { q: "Which cookie flag stops JavaScript from reading a cookie?", o: ["Secure", "HttpOnly", "SameSite", "Path"], a: 1, e: "HttpOnly hides the cookie from document.cookie, which limits damage from XSS." },
    { q: "IDOR is a flaw in which area?", o: ["Encryption strength", "Network speed", "Access control", "Logging"], a: 2, e: "With IDOR, changing an ID in a request exposes someone else's data because the server skips an authorization check." }
  ],
  network: [
    { q: "Which port does HTTPS use by default?", o: ["80", "22", "25", "443"], a: 3, e: "HTTP uses 80, SSH uses 22, SMTP uses 25, and HTTPS uses 443." },
    { q: "What does a firewall primarily do?", o: ["Filters traffic based on rules", "Encrypts files at rest", "Speeds up DNS", "Stores logs forever"], a: 0, e: "Firewalls allow or block traffic according to rules about addresses, ports and protocols." },
    { q: "Which tool is widely used to capture and inspect packets?", o: ["Docker", "Wireshark", "Git", "Photoshop"], a: 1, e: "Wireshark captures traffic and breaks it down protocol by protocol." },
    { q: "What does TLS provide for network traffic?", o: ["Compression only", "Faster routing", "IP addressing", "Encryption and server authentication"], a: 3, e: "TLS encrypts data in transit and lets clients verify the server's identity." }
  ],
  pentest: [
    { q: "What must you have before testing a system?", o: ["A fast laptop", "Written authorization", "A VPN", "A list of default passwords"], a: 1, e: "Without permission, testing is illegal. Scope and rules should be agreed in writing." },
    { q: "What is the goal of the reconnaissance phase?", o: ["Gather information about the target", "Delete evidence", "Write the final report", "Patch the systems"], a: 0, e: "Recon builds a picture of the target so later testing is focused and efficient." },
    { q: "What is a CVE?", o: ["A type of malware", "A firewall rule", "A public identifier for a known vulnerability", "An encryption mode"], a: 2, e: "CVE numbers give each publicly known vulnerability a unique, shared ID." },
    { q: "A good pentest report should include what?", o: ["Only a list of tools used", "Findings, evidence and recommended fixes", "Stolen passwords on the cover page", "Nothing about risk"], a: 1, e: "Clients need to know what was found, how serious it is, and how to fix it." }
  ],
  blue: [
    { q: "What does SIEM stand for?", o: ["Secure Internet Email Manager", "Security Information and Event Management", "System Integrity and Endpoint Monitoring", "Software Incident and Error Management"], a: 1, e: "A SIEM collects and correlates logs from many sources to surface threats." },
    { q: "Which comes first in the NIST incident response lifecycle?", o: ["Preparation", "Containment", "Recovery", "Lessons learned"], a: 0, e: "Preparation comes first, then detection and analysis, containment and recovery, and post-incident activity." },
    { q: "Why work on a forensic image instead of the original disk?", o: ["It uses less storage", "To avoid altering the original evidence", "Originals cannot be copied", "It hides the investigation"], a: 1, e: "Preserving the original keeps evidence intact and defensible." },
    { q: "What is MITRE ATT&CK?", o: ["A password cracker", "An antivirus engine", "A cloud provider", "A knowledge base of attacker tactics and techniques"], a: 3, e: "ATT&CK catalogs how real attackers operate, which helps with detection and defense." }
  ],
  cloud: [
    { q: "In the shared responsibility model, who secures the customer's data?", o: ["Always the provider", "The customer", "Nobody", "The domain registrar"], a: 1, e: "Providers secure the infrastructure, while customers secure their data, identities and configuration." },
    { q: "What does least privilege mean?", o: ["Everyone gets admin by default", "Share one account across the team", "Grant only the access needed to do the job", "Turn off logging"], a: 2, e: "Giving the minimum access limits the damage if an account is compromised." },
    { q: "Which is a common cause of cloud data leaks?", o: ["Publicly exposed storage buckets", "Too many regions", "Strong IAM policies", "Encrypted backups"], a: 0, e: "Misconfigured storage that is open to the internet is one of the most common leak sources." },
    { q: "Where should API keys and secrets live?", o: ["In the source code repo", "In a public README", "In a secrets manager", "In browser local storage"], a: 2, e: "Secrets managers store and rotate credentials safely, out of code and out of sight." }
  ]
};
