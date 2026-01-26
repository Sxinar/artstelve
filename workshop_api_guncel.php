<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require 'config.php';

try {
    // Tüm projeleri ve kullanıcı adlarını getir
    $sql = "
        SELECT 
            p.id, p.title as name, p.description, p.category, 
            p.file_path, COALESCE(p.image_path, pi.image_path) as image_path, 
            u.username as author 
        FROM projects p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN (
            SELECT project_id, MIN(image_path) as image_path FROM project_images GROUP BY project_id
        ) pi ON p.id = pi.project_id
        ORDER BY p.upload_date DESC
    ";
    
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $themes = [];
    $plugins = [];
    $homeThemes = []; // Ana sayfa temaları için yeni dizi
    
    // Base URL'i belirle
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    
    // api.php'nin kök dizine göre yolunu al (örn: /workshop/api.php)
    $scriptPath = $_SERVER['SCRIPT_NAME'];
    // Dosya ismini ve Workshop klasörünü çıkararak ana 'devs' dizinine ulaş
    $basePath = str_replace('/Workshop/api.php', '/', $scriptPath);
    $basePath = str_replace('/workshop/api.php', '/', $basePath);
    
    // Çift slaşları temizle
    $basePath = preg_replace('#/+#', '/', $basePath);
    $baseUrl = $protocol . "://" . $host . rtrim($basePath, '/') . '/';

    foreach ($results as $row) {
        $path = $row['file_path'];
        $imagePath = $row['image_path'];
        
        // ../ veya ./ veya / gibi tüm ön ekleri temizle
        $cleanPath = preg_replace('#^(\.+/*|/+)#', '', $path);
        $cleanImagePath = preg_replace('#^(\.+/*|/+)#', '', $imagePath);
        
        $item = [
            'id' => $row['id'],
            'name' => $row['name'],
            'author' => $row['author'] ?? 'Anonim',
            'description' => $row['description'],
            'download_url' => !empty($path) ? $baseUrl . $cleanPath : null,
            'image_url' => !empty($imagePath) ? $baseUrl . $cleanImagePath : null,
            'category' => $row['category'] // Kategori bilgisini de ekle
        ];
        
        // Kategoriye göre ayır - YENİ MANTIK
        $category = mb_strtolower($row['category'] ?? '', 'UTF-8');
        
        if ($category === 'artado_tema' || $category === 'site_tema') {
            // Site temaları
            $themes[] = $item;
        } elseif ($category === 'ana_sayfa' || $category === 'home') {
            // Ana sayfa temaları
            $homeThemes[] = $item;
        } elseif ($category === 'eklenti' || $category === 'plugin') {
            // Eklentiler
            $plugins[] = $item;
        } else {
            // Eğer kategori belirtilmemişse, isme göre tahmin et (geriye dönük uyumluluk)
            $lowerName = mb_strtolower($row['name'], 'UTF-8');
            if (strpos($lowerName, 'tema') !== false || strpos($lowerName, 'theme') !== false) {
                $themes[] = $item;
            } elseif (strpos($lowerName, 'eklenti') !== false || strpos($lowerName, 'plugin') !== false) {
                $plugins[] = $item;
            } else {
                // Varsayılan olarak eklenti olarak kabul et
                $plugins[] = $item;
            }
        }
    }
    
    // Ana sayfa temalarını plugins dizisine ekle (Artstelve'nin beklediği format)
    foreach ($homeThemes as $homeTheme) {
        $homeTheme['category'] = 'home'; // Kategoriyi normalize et
        $plugins[] = $homeTheme;
    }
    
    echo json_encode([
        'success' => true,
        'themes' => $themes,
        'plugins' => $plugins
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'themes' => [],
        'plugins' => [],
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}
?>
