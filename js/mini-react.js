function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: []
        }
    };
}

function createElement(type, props, ...children) {
    const normalizedChildren = children
        .flat(Infinity)
        .filter(child =>
            child !== null &&
            child !== undefined &&
            typeof child !== "boolean"
        )
        .map(child => {
            if (
                typeof child === "string" ||
                typeof child === "number"
            ) {
                return createTextElement(child);
            }

            return child;
        });

    return {
        type: type,
        props: {
            ...(props ?? {}),
            children: normalizedChildren
        }
    };
}

module.exports = {
    createTextElement,
    createElement
};