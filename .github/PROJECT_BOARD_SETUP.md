# GitHub Projects Board Setup

Guida per configurare un GitHub Projects board professionale per SpedireSicuro.

---

## 🎯 **Overview**

GitHub Projects V2 offre un Kanban board integrato con automation potente e gratuito.

**Benefici:**

- ✅ Visibility completa del lavoro in corso
- ✅ Sprint planning e velocity tracking
- ✅ Automation (issue → board, PR → review)
- ✅ Custom fields (Priority, Effort, Sprint)

---

## 🚀 **Quick Start (15 minuti)**

### **Step 1: Crea il Project**

1. Vai su: `https://github.com/gdsgroupsas-jpg/spediresicuro/projects`
2. Click **"New project"**
3. Scegli template: **"Board"** (Kanban view)
4. Nome: `SpedireSicuro Development`
5. Descrizione: `Main development board for features, bugs, and tasks`

### **Step 2: Configura le Colonne**

Rinomina/aggiungi colonne:

```
📋 Backlog        → Issue non ancora scheduled
🎯 Todo           → Scheduled for current/next sprint
🚧 In Progress    → Currently being worked on
👀 In Review      → PR open, waiting for review
✅ Done           → Completed (last 2 weeks visible)
```

### **Step 3: Custom Fields**

Aggiungi custom fields per tracking avanzato:

| Field        | Type               | Values                                       | Usage             |
| ------------ | ------------------ | -------------------------------------------- | ----------------- |
| **Priority** | Single select      | P0, P1, P2, P3                               | Criticality       |
| **Effort**   | Single select      | XS (1h), S (2-4h), M (1d), L (2-3d), XL (1w) | Time estimate     |
| **Sprint**   | Single select      | Sprint 1, Sprint 2, ...                      | Sprint assignment |
| **Area**     | Single select      | AI, Pricing, Wallet, UI, DevOps, Security    | Component         |
| **Status**   | Auto (from column) | -                                            | Current state     |

---

## 🤖 **Automation Setup**

### **Built-in Workflows**

Attiva le automation predefinite:

1. **Item added to project**
   - Action: Set status to "Backlog"

2. **Item reopened**
   - Action: Set status to "Todo"

3. **Pull request merged**
   - Action: Set status to "Done"

### **Custom Workflows**

Crea automation avanzate:

#### **Auto-move on PR creation**

```yaml
# When PR is created
Trigger: Pull request opened
Condition: PR links to issue in project
Action: Set status to "In Review"
```

#### **Auto-archive completed items**

```yaml
# After 14 days in Done
Trigger: Item in "Done" for 14 days
Action: Archive item
```

#### **Priority escalation**

```yaml
# P0 issues auto-move to Todo
Trigger: Issue labeled "P0 - Critical"
Action: Set status to "Todo"
```

---

## 📊 **Views Setup**

Oltre al Kanban board, crea views aggiuntive:

### **1. Sprint Planning View**

- Layout: **Table**
- Group by: **Sprint**
- Sort by: **Priority** (descending)
- Filter: `Status != Done`

### **2. Priority Matrix**

- Layout: **Board**
- Group by: **Priority**
- Sort by: **Created** (newest first)

### **3. Team Capacity**

- Layout: **Table**
- Group by: **Assignee**
- Fields: Title, Effort, Status
- Filter: `Status = In Progress OR Status = Todo`

### **4. Velocity Tracker**

- Layout: **Table**
- Group by: **Sprint**
- Fields: Title, Effort, Status
- Sort by: **Sprint** (descending)

---

## 🏷️ **Labels Strategy**

Usa labels consistenti con le categorie:

### **Type Labels**

- `type: feature` (🎨 blue)
- `type: bug` (🐛 red)
- `type: refactor` (♻️ yellow)
- `type: docs` (📚 gray)
- `type: chore` (🔧 green)

### **Priority Labels**

- `P0 - Critical` (🔴 red)
- `P1 - High` (🟠 orange)
- `P2 - Medium` (🟡 yellow)
- `P3 - Low` (🟢 green)

### **Area Labels**

- `area: ai` (AI/Agent)
- `area: pricing` (Pricing Engine)
- `area: wallet` (Financial Core)
- `area: ui` (Frontend)
- `area: api` (Backend)
- `area: devops` (CI/CD)
- `area: security` (Security)

### **Status Labels**

- `status: blocked` (🚫 red)
- `status: needs-info` (❓ purple)
- `status: ready-for-review` (👀 blue)

---

## 📅 **Sprint Planning Workflow**

### **Sprint Cadence**

- **Duration**: 2 settimane
- **Planning**: Lunedì mattina (1h)
- **Review**: Venerdì pomeriggio (30min)
- **Retrospective**: Venerdì pomeriggio (30min)

### **Planning Process**

1. **Review Backlog** (15 min)
   - Triage nuove issue
   - Aggiorna priority
   - Chiarifica requirements

2. **Select Sprint Items** (30 min)
   - Filtra per priority e effort
   - Assegna a sprint corrente
   - Balance team capacity

3. **Assign Tasks** (15 min)
   - Assegna issue a developer
   - Verifica dependencies
   - Set sprint goal

### **Capacity Planning**

**Team capacity per sprint** (esempio):

- 1 developer full-time: ~40 effort points (80h)
- Effort mapping:
  - XS (1h) = 1 point
  - S (2-4h) = 3 points
  - M (1d) = 8 points
  - L (2-3d) = 16 points
  - XL (1w) = 40 points

---

## 📈 **Metrics & Reporting**

### **Velocity Tracking**

Track completed effort points per sprint:

```markdown
| Sprint   | Planned | Completed | Velocity % |
| -------- | ------- | --------- | ---------- |
| Sprint 1 | 40 pts  | 35 pts    | 87.5%      |
| Sprint 2 | 45 pts  | 42 pts    | 93.3%      |
| Sprint 3 | 40 pts  | 40 pts    | 100%       |
```

### **Burndown Chart**

Manuale (o tool esterno):

- X-axis: Giorni del sprint
- Y-axis: Effort points rimanenti
- Ideal line: Linear decrease
- Actual line: Real progress

### **Lead Time**

Track tempo medio da "Todo" a "Done":

- P0: Target <24h
- P1: Target <3 giorni
- P2: Target <1 settimana

---

## 🔗 **Integration con Workflow**

### **Issue Templates → Project**

Modifica issue templates per auto-add al project:

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
body:
  - type: markdown
    attributes:
      value: |
        **Note:** This issue will be automatically added to the Development board.
```

Poi abilita automation: `Item added → Set to Backlog`

### **PR Linking**

Nei PR, usa keywords per linkare issue:

```markdown
Closes #123
Fixes #456
Resolves #789
```

Automation muoverà automaticamente a "Done" quando PR è merged.

---

## 🎨 **Board Customization**

### **Card Layout**

Configura cosa mostrare su ogni card:

- ✅ Title
- ✅ Assignee avatar
- ✅ Labels (priority, area)
- ✅ Linked PR count
- ✅ Comment count

### **Column Limits**

Set WIP (Work In Progress) limits:

- Todo: no limit
- In Progress: max 3 items per developer
- In Review: max 5 items total

### **Card Colors**

Color-code by priority:

- P0: Red background
- P1: Orange border
- P2: Yellow tint
- P3: Default

---

## 📖 **Best Practices**

### **DO's ✅**

- ✅ Update status daily
- ✅ Link PR to issue immediatamente
- ✅ Add comments per progress update
- ✅ Use custom fields consistentemente
- ✅ Archive Done items after 14 giorni
- ✅ Review backlog settimanalmente

### **DON'Ts ❌**

- ❌ Lasciare issue in "In Progress" per >3 giorni senza update
- ❌ Creare issue senza priority label
- ❌ Merge PR senza linkare issue
- ❌ Cambiare sprint assignment mid-sprint (eccetto P0)

---

## 🔍 **Example Queries**

### **Current Sprint Workload**

```
is:open sprint:"Sprint 5" status:"In Progress" OR status:"Todo"
```

### **Blocked Items**

```
is:open label:"status: blocked"
```

### **P0 Items Not Started**

```
is:open label:"P0 - Critical" status:"Backlog" OR status:"Todo"
```

### **Unassigned High Priority**

```
is:open label:"P1 - High" no:assignee
```

---

## 🚦 **Status Definitions**

| Status          | Definition                  | SLA                 |
| --------------- | --------------------------- | ------------------- |
| **Backlog**     | Not yet scheduled           | -                   |
| **Todo**        | Scheduled, ready to start   | Start within sprint |
| **In Progress** | Actively being worked on    | Update daily        |
| **In Review**   | PR open, waiting for review | Review within 24h   |
| **Done**        | Completed & merged          | Archive after 14d   |

---

## 📞 **Support**

**Questions?**

- GitHub Projects docs: https://docs.github.com/en/issues/planning-and-tracking-with-projects
- Team discussion: GitHub Discussions

---

## ✅ **Setup Checklist**

- [ ] Create project board
- [ ] Configure columns (5 standard)
- [ ] Add custom fields (Priority, Effort, Sprint, Area)
- [ ] Setup automation (3 built-in workflows)
- [ ] Create additional views (Sprint Planning, Priority Matrix)
- [ ] Configure labels strategy
- [ ] Set WIP limits
- [ ] Document sprint cadence
- [ ] Train team on workflow
- [ ] Link existing issues to board

**Estimated time: 1 hour** ✅

---

**Last Updated:** 2026-01-20
**Status:** Ready for implementation
