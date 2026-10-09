// Lấy phần tử DOM chứa ứng dụng
const root = document.getElementById("root");

// Component giao diện thử nghiệm
function App() {
    const [count, setCount] = MiniReact.useState(0);

    return MiniReact.createElement(
        "main",
        {},
        MiniReact.createElement("p", {}, `Count: ${count}`),
        MiniReact.createElement(
            "button",
            {
                onClick: () => setCount(previous => previous + 1)
            },
            "Increment"
        )
    );
}

// 1. Đăng ký quy trình render với MiniReact
MiniReact.setRenderApp(() => {
    const appVNode = App();

    // Xóa UI cũ và thay bằng UI mới đã được render
    root.replaceChildren(
        MiniReact.renderToDOM(appVNode)
    );
});

// 2. Chạy lượt render đầu tiên khi mở trang
MiniReact.renderApp();