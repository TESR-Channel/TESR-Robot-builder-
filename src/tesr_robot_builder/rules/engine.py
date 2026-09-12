"""Validation Engine — a registry of rules, each returning findings.

Severity: ``ERROR`` blocks generate/deploy, ``WARN`` needs acknowledgement,
``PASS`` is recorded so the report shows what was checked (the UI renders
the ✅/⚠️/🔴 list from this).

Driver plugins may contribute rules of their own (Phase 1): register them with
:func:`register`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Literal

from ..registry.loader import Registry
from ..resolve import ResolvedRobot
from ..schema.definition import RobotDefinition

Severity = Literal["PASS", "WARN", "ERROR"]
Category = Literal[
    "mechanical", "drivetrain", "power", "hardware", "tf", "ros", "navigation", "safety", "sensor"
]


@dataclass(frozen=True)
class Finding:
    rule_id: str
    category: Category
    severity: Severity
    message: str
    path: str = ""  # dotted path into the definition, when applicable
    suggestion: str = ""


@dataclass
class RuleContext:
    defn: RobotDefinition
    resolved: ResolvedRobot
    registry: Registry


RuleFn = Callable[[RuleContext], list[Finding]]


@dataclass
class Rule:
    id: str
    category: Category
    description: str
    fn: RuleFn


_RULES: dict[str, Rule] = {}


def register(rule_id: str, category: Category, description: str):
    """Decorator: ``@register("R-TF-001", "tf", "frames are unique")``."""

    def deco(fn: RuleFn) -> RuleFn:
        if rule_id in _RULES:
            raise ValueError(f"duplicate rule id {rule_id}")
        _RULES[rule_id] = Rule(rule_id, category, description, fn)
        return fn

    return deco


def all_rules() -> list[Rule]:
    return [_RULES[k] for k in sorted(_RULES)]


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "ERROR"]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "WARN"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def by_category(self) -> dict[str, list[Finding]]:
        out: dict[str, list[Finding]] = {}
        for f in self.findings:
            out.setdefault(f.category, []).append(f)
        return out


def run_rules(ctx: RuleContext, rules: list[Rule] | None = None) -> Report:
    report = Report()
    for rule in rules or all_rules():
        findings = rule.fn(ctx)
        if findings:
            report.findings.extend(findings)
        else:
            report.findings.append(Finding(rule.id, rule.category, "PASS", rule.description))
    return report
