# Host build of the portable firmware modules + golden-vector checks.
#   make -C firmware/test        build and run
#   make -C firmware/test clean
SRC_DIR := ../jimmyit_fidget/src
VECTORS := ../../packages/protocol/vectors/v1.json
BUILD := build
CXX ?= c++
CXXFLAGS := -std=c++17 -Wall -Wextra -Werror -I$(SRC_DIR) -I$(BUILD)
SOURCES := test_main.cpp $(wildcard $(SRC_DIR)/*.cpp)

.PHONY: test clean
test: $(BUILD)/firmware_tests
	./$(BUILD)/firmware_tests

$(BUILD)/vectors.generated.h: $(VECTORS) gen_vectors.py
	@mkdir -p $(BUILD)
	python3 gen_vectors.py $(VECTORS) $@

$(BUILD)/firmware_tests: $(SOURCES) $(wildcard $(SRC_DIR)/*.h) $(BUILD)/vectors.generated.h
	$(CXX) $(CXXFLAGS) $(SOURCES) -o $@

clean:
	rm -rf $(BUILD)
