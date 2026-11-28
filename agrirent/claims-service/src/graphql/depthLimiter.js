const { GraphQLError, Kind } = require('graphql');

function depthLimit(maxDepth) {
  return (context) => {
    return {
      OperationDefinition(node) {
        const depth = calculateDepth(node);
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `Query exceeds maximum allowed depth of ${maxDepth} (calculated depth: ${depth}).`,
              {
                nodes: [node],
                extensions: { code: 'QUERY_TOO_DEEP' },
              }
            )
          );
        }
      },
    };
  };
}

function calculateDepth(node, currentDepth = 0) {
  if (!node.selectionSet || !node.selectionSet.selections) {
    return currentDepth;
  }

  let maxChildDepth = currentDepth;
  for (const selection of node.selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      // Ignore __typename and introspection queries from artificial depth
      if (selection.name.value.startsWith('__')) {
        continue;
      }
      const childDepth = calculateDepth(selection, currentDepth + 1);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT || selection.kind === Kind.FRAGMENT_SPREAD) {
      const childDepth = calculateDepth(selection, currentDepth);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }
  }

  return maxChildDepth;
}

module.exports = {
  depthLimit,
  calculateDepth,
};
