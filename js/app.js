
"use strict";

(() => {
  const {
    createElement,
    renderToDOM,
    useState,
    setRenderApp,
    renderApp,
    setupEventDelegation
  } = window.MiniReact;

  const root = document.getElementById("app");

  if (!root) {
    throw new Error('Application root "#app" was not found.');
  }

  let nextTaskId = 1;

  // TASK 2.12: Reactive Todo operations
  function TodoApp() {
    const [tasks, setTasks] = useState([]);
    const [filter, setFilter] = useState("ALL");

    // Add a task using the delegated form submit event.
    // Clicking Add Task and pressing Enter both submit this form.
    function handleSubmit(event) {
      event.preventDefault();

      const form = this;
      const input = form.querySelector("#task-input");
      if (!input) return;

      const text = input.value.trim();

      // Reject empty or whitespace-only task names.
      if (!text) {
        input.focus();
        return;
      }

      const newTask = {
        id: nextTaskId++,
        text,
        completed: false
      };

      // Clear before the synchronous rerender replaces the DOM.
      input.value = "";

      setTasks(previousTasks => [...previousTasks, newTask]);
    }

    function handleToggleTask(taskId) {
      setTasks(previousTasks =>
        previousTasks.map(task =>
          task.id === taskId
            ? { ...task, completed: !task.completed }
            : task
        )
      );
    }

    function handleFilterChange(nextFilter) {
      setFilter(nextFilter);
    }

    const visibleTasks = tasks.filter(task => {
      if (filter === "COMPLETED") return task.completed;
      if (filter === "PENDING") return !task.completed;
      return true;
    });

    return createElement(
      "section",
      { "aria-labelledby": "todo-title" },

      createElement(
        "header",
        {},
        createElement("h1", { id: "todo-title" }, "My Todo List"),
        createElement(
          "p",
          {},
          "Organize your tasks and keep track of what you need to do."
        )
      ),

      // Task form
      createElement(
        "form",
        {
          id: "task-form",
          onSubmit: handleSubmit
        },
        createElement("label", { for: "task-input" }, "Task name"),
        createElement("input", {
          id: "task-input",
          name: "task",
          type: "text",
          placeholder: "Enter a task",
          autocomplete: "off"
        }),
        createElement("button", { type: "submit" }, "Add Task")
      ),

      // Filters
      createElement(
        "nav",
        { "aria-label": "Filter tasks" },
        createElement(
          "button",
          {
            type: "button",
            "aria-pressed": String(filter === "ALL"),
            onClick: () => handleFilterChange("ALL")
          },
          "All"
        ),
        createElement(
          "button",
          {
            type: "button",
            "aria-pressed": String(filter === "COMPLETED"),
            onClick: () => handleFilterChange("COMPLETED")
          },
          "Completed"
        ),
        createElement(
          "button",
          {
            type: "button",
            "aria-pressed": String(filter === "PENDING"),
            onClick: () => handleFilterChange("PENDING")
          },
          "Pending"
        )
      ),

      // Task list
      createElement(
        "section",
        { "aria-labelledby": "task-list-title" },
        createElement("h2", { id: "task-list-title" }, "Tasks"),

        createElement(
          "p",
          {
            id: "empty-state",
            role: "status",
            "aria-live": "polite"
          },
          visibleTasks.length === 0
            ? tasks.length === 0
              ? "No tasks yet. Add a task to get started."
              : "No tasks match this filter."
            : ""
        ),

        createElement(
          "ul",
          {
            id: "task-list",
            "aria-label": "Task list"
          },
          ...visibleTasks.map(task =>
            createElement(
              "li",
              { key: String(task.id) },

              createElement(
                "span",
                {
                  "data-task-id": String(task.id)
                },
                task.completed ? "✓ " : "",
                task.text
              ),

              createElement(
                "button",
                {
                  type: "button",
                  "aria-label": task.completed
                    ? `Mark ${task.text} as pending`
                    : `Mark ${task.text} as completed`,
                  onClick: () => handleToggleTask(task.id)
                },
                task.completed ? "Mark Pending" : "Complete"
              )
            )
          )
        )
      )
    );
  }

  // Register the application render function.
  setRenderApp(() => {
    const appVNode = TodoApp();
    const appDOM = renderToDOM(appVNode);

    root.replaceChildren(appDOM);
    root.removeAttribute("aria-busy");
  });

  // TASK 2.13: install delegated events once at the root.
  setupEventDelegation(root, ["click", "input", "submit"]);

  // Initial render.
  renderApp();
})();