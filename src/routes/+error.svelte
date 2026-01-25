<script>
    import { page } from "$app/stores";
</script>

<div class="error-container">
    <h1>{$page.status}</h1>
    <p>{$page.error?.message || "Bir hata oluştu."}</p>
    <div class="actions">
        <a href="/" class="home-button">
            <i class="fas fa-home"></i>
            Ana Sayfaya Dön
        </a>
    </div>
</div>

<style>
    .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 70vh; /* Occupy most of the screen but leave room for header/footer if present */
        text-align: center;
        padding: 2rem;
        color: var(--text-color);
    }

    h1 {
        font-size: 6rem;
        margin: 0;
        line-height: 1;
        background: linear-gradient(
            135deg,
            var(--primary-color),
            var(--accent-color)
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
    }

    p {
        font-size: 1.5rem;
        margin: 1rem 0 2rem 0;
        color: var(--text-color-secondary);
    }

    .home-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.8rem 1.5rem;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 50px;
        font-weight: 500;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    }

    .home-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.2);
        text-decoration: none;
    }

    .home-button:active {
        transform: translateY(0);
    }
</style>
