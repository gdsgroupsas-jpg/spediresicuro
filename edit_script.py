from pathlib import Path
p=Path("agent/tooling_plan.py")
lines=p.read_text().splitlines()
for i,l in enumerate(lines):
    if l.strip()=="args = tool_call.get(\"args\", {})":
        idx=i+1
        break
else:
    raise SystemExit('args line not found')
insert=[
"            if tool_name == \"safe_write\":",
"                if args.get(\"dry_run\") is True:",
"                    args[\"dry_run\"] = False",
"                elif \"dry_run\" not in args:",
"                    args[\"dry_run\"] = False",
"",
]
lines[idx:idx]=insert
p.write_text('\n'.join(lines)+'\n')
