from typing import Any
from pydantic import AliasGenerator, BaseModel, ConfigDict, SerializationInfo, model_serializer
from pydantic.alias_generators import to_camel


def _enrich_dual_case(value: Any) -> Any:
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            enriched_v = _enrich_dual_case(v)
            out[k] = enriched_v
            if isinstance(k, str) and "_" in k:
                camel_k = to_camel(k)
                if camel_k not in value:
                    out[camel_k] = enriched_v
        return out
    if isinstance(value, list):
        return [_enrich_dual_case(item) for item in value]
    return value


class DualCaseModel(BaseModel):
    """Base Pydantic v2 model that accepts both snake_case and camelCase on input,
    keeps pure snake_case for Python model_dump() (SQLAlchemy kwargs), and emits
    both snake_case and camelCase keys on JSON serialization for HTTP responses.
    """

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=AliasGenerator(validation_alias=to_camel),
    )

    @model_serializer(mode="wrap")
    def _serialize_dual_case(self, handler, info: SerializationInfo) -> dict[str, Any]:
        data = handler(self)
        if info.mode == "json":
            return _enrich_dual_case(data)
        return data
