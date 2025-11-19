import json
import copy


def strip_not_from_schema(schema):
    """
    Recursively removes 'not' keys from a JSON schema dictionary or list.
    """
    if isinstance(schema, dict):
        # Create a new dictionary excluding the 'not' key, and recurse on values
        return {k: strip_not_from_schema(v) for k, v in schema.items() if k != "not"}
    elif isinstance(schema, list):
        # Recurse on each item in the list
        return [strip_not_from_schema(item) for item in schema]
    else:
        # Return primitive values as is
        return schema


def test_sanitization():
    # Example schema with 'not' construct (similar to what causes the error)
    problematic_schema = {
        "type": "object",
        "properties": {
            "time": {"type": "string", "not": {"const": "invalid_time"}},
            "nested": {"type": "object", "properties": {"forbidden": {"not": {}}}},
        },
    }

    print("Original Schema:")
    print(json.dumps(problematic_schema, indent=2))

    sanitized_schema = strip_not_from_schema(problematic_schema)

    print("\nSanitized Schema:")
    print(json.dumps(sanitized_schema, indent=2))

    # Verification
    assert "not" not in sanitized_schema["properties"]["time"]
    assert (
        "not" not in sanitized_schema["properties"]["nested"]["properties"]["forbidden"]
    )

    print("\nSUCCESS: All 'not' keys were removed.")


if __name__ == "__main__":
    test_sanitization()
