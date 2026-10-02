"""
GET  /api/correlations              — List correlations with pagination
GET  /api/correlations/{correlation_id} — Get a single correlation
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import Pagination, get_current_user
from app.core.database import get_db
from app.models import Correlation
from app.schemas.common import CorrelationResponse, PaginatedCorrelations

router = APIRouter(prefix="/api/correlations", tags=["correlations"])


@router.get("", response_model=PaginatedCorrelations, summary="List correlations")
async def list_correlations(
    correlation_key: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = select(Correlation)
    if correlation_key:
        query = query.where(Correlation.correlation_key == correlation_key)
    if entity_id:
        query = query.where(Correlation.entity_id == entity_id)
    if status_filter:
        query = query.where(Correlation.status == status_filter)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = (
        query.order_by(Correlation.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedCorrelations(
        items=[CorrelationResponse.model_validate(i) for i in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=max(1, math.ceil(total / pagination.page_size)),
    )


@router.get(
    "/{correlation_id}",
    response_model=CorrelationResponse,
    summary="Get correlation by ID",
)
async def get_correlation(
    correlation_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.execute(
        select(Correlation).where(Correlation.correlation_id == correlation_id)
    )
    corr = result.scalar_one_or_none()
    if corr is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "CORRELATION_NOT_FOUND",
                "message": f"Correlation {correlation_id} was not found",
            },
        )
    return CorrelationResponse.model_validate(corr)
