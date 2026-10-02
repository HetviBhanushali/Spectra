"""
GET   /api/rules           — List rules
POST  /api/rules           — Create a rule (OPERATOR+)
PATCH /api/rules/{rule_id} — Update a rule (OPERATOR+)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.models import Rule
from app.schemas.common import RuleCreate, RuleResponse, RuleUpdate

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("", response_model=list[RuleResponse], summary="List rules")
async def list_rules(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.execute(select(Rule).order_by(Rule.created_at.asc()))
    return [RuleResponse.model_validate(r) for r in result.scalars().all()]


@router.post(
    "",
    response_model=RuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a rule",
)
async def create_rule(
    body: RuleCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("ADMIN", "OPERATOR")),
):
    existing = await db.execute(
        select(Rule).where(Rule.rule_id == body.rule_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "RULE_EXISTS", "message": f"Rule '{body.rule_id}' already exists"},
        )
    rule = Rule(**body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)


@router.patch(
    "/{rule_id}",
    response_model=RuleResponse,
    summary="Update a rule",
)
async def update_rule(
    rule_id: str,
    body: RuleUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("ADMIN", "OPERATOR")),
):
    result = await db.execute(select(Rule).where(Rule.rule_id == rule_id))
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RULE_NOT_FOUND", "message": f"Rule '{rule_id}' not found"},
        )
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)
