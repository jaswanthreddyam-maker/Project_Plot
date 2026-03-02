export async function checkOllamaStatus(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
        const res = await fetch("http://localhost:11434/", {
            method: "GET",
            signal: controller.signal,
        });
        return res.status === 200;
    } catch {
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
}
