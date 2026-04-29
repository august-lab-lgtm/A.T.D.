#include <iostream>
#include <vector>
#include <map>
#include <string>
#include <ctime>
#include <opencv2/opencv.hpp>
#include <opencv2/highgui.hpp>
#include <opencv2/video.hpp>
#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <nlohmann/json.hpp>

// Axis ACAP includes
#include <axis/axis.h>
#include <axis/http_server.h>
#include <axis/camera.h>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = boost::asio::ip::tcp;
using json = nlohmann::json;

struct Point {
    double x, y;
};

struct Person {
    std::string id;
    Point position;
    std::vector<Point> path;
    time_t createdAt;
    double opacity;
};

struct MotionPoint {
    double x, y;
    bool detected;
    double confidence;
    std::string id;
};

struct HeatmapCell {
    int x, y;
    double intensity;
};

struct ActivityDataPoint {
    std::string time;
    int count;
};

class ATDMotionDetector {
private:
    cv::VideoCapture cap;
    cv::Mat prevFrame;
    std::vector<Person> people;
    std::vector<MotionPoint> trackedTargets;
    std::vector<HeatmapCell> heatmapGrid;
    std::vector<ActivityDataPoint> activityHistory;
    int currentCount;
    const int GRID_SIZE = 10;
    const cv::Size BOUNDS = cv::Size(600, 400);

    // HTTP server for web interface
    net::io_context ioc;
    tcp::acceptor acceptor;
    std::thread serverThread;

public:
    ATDMotionDetector() : acceptor(ioc, tcp::endpoint(tcp::v4(), 8080)), currentCount(0) {
        // Initialize camera
        if (!cap.open(0)) {
            std::cerr << "Error opening camera" << std::endl;
        }

        // Start HTTP server
        startServer();
    }

    ~ATDMotionDetector() {
        cap.release();
        ioc.stop();
        if (serverThread.joinable()) {
            serverThread.join();
        }
    }

    void run() {
        cv::Mat frame;
        while (true) {
            cap >> frame;
            if (frame.empty()) break;

            processFrame(frame);
            updateSimulation();

            // Sleep for 500ms
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
        }
    }

private:
    void processFrame(const cv::Mat& frame) {
        cv::Mat gray, diff;
        cv::cvtColor(frame, gray, cv::COLOR_BGR2GRAY);

        if (!prevFrame.empty()) {
            cv::absdiff(gray, prevFrame, diff);
            cv::threshold(diff, diff, 25, 255, cv::THRESH_BINARY);

            // Detect motion points
            std::vector<MotionPoint> detected = detectMultipleTargets(frame, prevFrame);
            trackedTargets = detected;

            // Update heatmap
            updateHeatmap();
        }

        prevFrame = gray.clone();
    }

    std::vector<MotionPoint> detectMultipleTargets(const cv::Mat& current, const cv::Mat& previous) {
        std::vector<MotionPoint> targets;

        // Convert to HSV for better skin detection
        cv::Mat currentHSV, previousHSV;
        cv::cvtColor(current, currentHSV, cv::COLOR_BGR2HSV);
        cv::cvtColor(previous, previousHSV, cv::COLOR_BGR2HSV);

        // Motion detection
        cv::Mat diff;
        cv::absdiff(currentHSV, previousHSV, diff);
        cv::cvtColor(diff, diff, cv::COLOR_BGR2GRAY);
        cv::threshold(diff, diff, 30, 255, cv::THRESH_BINARY);

        // Find contours
        std::vector<std::vector<cv::Point>> contours;
        cv::findContours(diff, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);

        for (size_t i = 0; i < contours.size(); ++i) {
            cv::Rect rect = cv::boundingRect(contours[i]);
            if (rect.area() > 100) { // Minimum area threshold
                MotionPoint point;
                point.x = rect.x + rect.width / 2.0;
                point.y = rect.y + rect.height / 2.0;
                point.detected = true;
                point.confidence = 0.8;
                point.id = "target_" + std::to_string(i);
                targets.push_back(point);
            }
        }

        return targets;
    }

    void updateHeatmap() {
        heatmapGrid.clear();
        std::vector<Person> allPoints = people;

        // Add tracked targets as people
        for (const auto& target : trackedTargets) {
            Person p;
            p.id = target.id;
            p.position = {target.x, target.y};
            p.opacity = 1.0;
            allPoints.push_back(p);
        }

        // Calculate heatmap
        double cellWidth = BOUNDS.width / (double)GRID_SIZE;
        double cellHeight = BOUNDS.height / (double)GRID_SIZE;

        for (int x = 0; x < GRID_SIZE; ++x) {
            for (int y = 0; y < GRID_SIZE; ++y) {
                double intensity = 0.0;

                for (const auto& person : allPoints) {
                    int cellX = (int)(person.position.x / cellWidth);
                    int cellY = (int)(person.position.y / cellHeight);

                    if (cellX == x && cellY == y) {
                        intensity += person.opacity;
                    }
                }

                heatmapGrid.push_back({x, y, std::min(intensity, 1.0)});
            }
        }
    }

    void updateSimulation() {
        // Remove old people
        time_t now = time(nullptr);
        people.erase(
            std::remove_if(people.begin(), people.end(),
                [now](const Person& p) { return now - p.createdAt > 10; }),
            people.end()
        );

        // Add new person occasionally
        if (rand() % 10 == 0 && people.size() < 5) {
            Person newPerson = createPerson();
            people.push_back(newPerson);
        }

        // Update existing people
        for (auto& person : people) {
            updatePerson(person);
        }

        currentCount = people.size() + trackedTargets.size();

        // Update activity history
        updateActivityHistory();
    }

    Person createPerson() {
        Person p;
        p.id = "person_" + std::to_string(time(nullptr)) + "_" + std::to_string(rand());
        p.position = {rand() % BOUNDS.width, rand() % BOUNDS.height};
        p.createdAt = time(nullptr);
        p.opacity = 1.0;

        // Generate path
        for (int i = 0; i < 20 + rand() % 30; ++i) {
            Point next = {
                std::max(0.0, std::min((double)BOUNDS.width, p.position.x + (rand() % 80 - 40))),
                std::max(0.0, std::min((double)BOUNDS.height, p.position.y + (rand() % 80 - 40)))
            };
            p.path.push_back(next);
        }

        return p;
    }

    void updatePerson(Person& person) {
        time_t now = time(nullptr);
        double age = now - person.createdAt;
        double progress = age / 10.0; // 10 second lifetime
        int pathIndex = std::min((int)(progress * person.path.size()), (int)person.path.size() - 1);

        person.position = person.path[pathIndex];
        person.opacity = 1.0 - progress * 0.7;
    }

    void updateActivityHistory() {
        time_t now = time(nullptr);
        char timeStr[9];
        strftime(timeStr, sizeof(timeStr), "%H:%M:%S", localtime(&now));

        ActivityDataPoint data;
        data.time = timeStr;
        data.count = currentCount;

        activityHistory.push_back(data);

        // Keep only last 60 entries (10 minutes at 10s intervals)
        if (activityHistory.size() > 60) {
            activityHistory.erase(activityHistory.begin());
        }
    }

    void startServer() {
        serverThread = std::thread([this]() {
            try {
                std::cout << "Starting HTTP server on port 8080" << std::endl;
                ioc.run();
            } catch (const std::exception& e) {
                std::cerr << "Server error: " << e.what() << std::endl;
            }
        });

        // Set up route handlers
        setupRoutes();
    }

    void setupRoutes() {
        // Main page
        http::response<http::string_body> res{http::status::ok, 11};
        res.set(http::field::server, "ATD Motion Detector");
        res.set(http::field::content_type, "text/html");
        res.body() = generateHTML();
        res.prepare_payload();

        // TODO: Add proper routing
    }

    std::string generateHTML() {
        std::stringstream html;
        html << "<!DOCTYPE html><html><head><title>ATD Motion Detector</title>";
        html << "<style>";
        html << "body { font-family: monospace; background: #0f172a; color: white; margin: 0; padding: 20px; }";
        html << ".header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }";
        html << ".stats { display: flex; gap: 20px; margin-bottom: 20px; }";
        html << ".stat { background: #1e293b; padding: 15px; border-radius: 5px; border: 1px solid #dc2626; }";
        html << ".canvas { border: 1px solid #dc2626; background: #1e293b; }";
        html << "</style></head><body>";

        html << "<div class='header'>";
        html << "<h1>PHALANX TRACKING</h1>";
        html << "<div>Active Targets: " << trackedTargets.size() << "</div>";
        html << "</div>";

        html << "<div class='stats'>";
        html << "<div class='stat'>Active Locks: " << trackedTargets.size() << "</div>";
        html << "<div class='stat'>Total Subjects: " << currentCount << "</div>";
        html << "<div class='stat'>Response Time: 16ms</div>";
        html << "<div class='stat'>Spectrum: FULL RGB</div>";
        html << "</div>";

        html << "<canvas id='floorplan' class='canvas' width='600' height='400'></canvas>";
        html << "<canvas id='heatmap' class='canvas' width='600' height='400'></canvas>";

        html << "<script>";
        html << "function updateDisplay() {";
        html << "  var ctx = document.getElementById('floorplan').getContext('2d');";
        html << "  ctx.clearRect(0, 0, 600, 400);";

        // Draw people
        for (const auto& person : people) {
            html << "  ctx.fillStyle = 'rgba(255, 255, 255, " << person.opacity << ")';";
            html << "  ctx.fillRect(" << person.position.x - 2 << ", " << person.position.y - 2 << ", 4, 4);";
        }

        // Draw tracked targets
        for (const auto& target : trackedTargets) {
            html << "  ctx.fillStyle = 'rgba(220, 38, 38, 0.8)';";
            html << "  ctx.fillRect(" << target.x - 3 << ", " << target.y - 3 << ", 6, 6);";
        }

        html << "  var hctx = document.getElementById('heatmap').getContext('2d');";
        html << "  hctx.clearRect(0, 0, 600, 400);";

        // Draw heatmap
        for (const auto& cell : heatmapGrid) {
            double intensity = cell.intensity;
            std::string color = getHeatmapColor(intensity);
            html << "  hctx.fillStyle = '" << color << "';";
            html << "  hctx.fillRect(" << cell.x * 60 << ", " << cell.y * 40 << ", 60, 40);";
        }

        html << "}";
        html << "setInterval(updateDisplay, 500);";
        html << "</script>";

        html << "</body></html>";
        return html.str();
    }

    std::string getHeatmapColor(double intensity) {
        if (intensity < 0.2) return "#3b82f6"; // blue
        if (intensity < 0.4) return "#06b6d4"; // cyan
        if (intensity < 0.6) return "#eab308"; // yellow
        if (intensity < 0.8) return "#f97316"; // orange
        return "#dc2626"; // red
    }
};

int main() {
    std::cout << "Starting ATD Motion Detector..." << std::endl;

    ATDMotionDetector detector;
    detector.run();

    return 0;
}