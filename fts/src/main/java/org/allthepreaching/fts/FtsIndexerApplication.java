package org.allthepreaching.fts;

import org.allthepreaching.fts.config.IndexerProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(IndexerProperties.class)
public class FtsIndexerApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(FtsIndexerApplication.class);
        application.setWebApplicationType(WebApplicationType.NONE);
        application.run(args);
    }
}